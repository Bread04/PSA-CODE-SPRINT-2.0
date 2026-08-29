"""Demo trigger: the "Three-Way Disruption" live run (spec-demo-three-way-disruption-trigger).

`api/demo_seed.py` inserts *static* pre-baked incidents; nothing there drives a
real incident through the pipeline live. This module adds a dev-only driver that
creates a genuine `Incident` via `IncidentRegistry.correlate()` and then runs
the **real** `run_specialists` -> `synthesize_options` ->
`run_policy_and_execution` chain against an injected offline scripted LLM client,
pacing the phases with `asyncio.sleep` so the console's 2.5s poll catches each
transition.

Strictly additive (spec Boundaries): `backend/agents/*`,
`backend/orchestrator/run.py`, and `backend/policy/*` keep their current logic
and signatures byte-for-byte. The driver is the sole writer (AD-4) of the
incidents it creates; it registers them through `api.state.get_registry()` so
`GET /incidents` serves them.

Offline + deterministic: no network, no `ANTHROPIC_API_KEY`, no randomness or
wall-clock branching. `step_delay` is `0` under tests so they run instantly.

Primary incident A ("Three-Way Disruption": berth + crane + yard, specialists
disagree, the crane call falls back) -> a DG-involved top option -> a real DG
re-plan loop -> a non-DG re-planned option that is Tier 3 (high risk, confidence
~65) -> held for operator approval. ~3*step_delay in, a second incident B runs
concurrently through the same chain and auto-resolves to VERIFY.
"""

from __future__ import annotations

import asyncio
import json
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from typing import Any

from api.state import get_registry
from models.incident import Incident, TraceEntry
from models.recovery import PredictedImpact, RecoveryOption
from models.signal import Signal

from agents.arbiter import ArbiterResult
from agents.dispatch import run_specialists, synthesize_options
from orchestrator.run import run_policy_and_execution
from orchestrator.trace import append_trace, error_shape

# --------------------------------------------------------------------------- #
# One-run-at-a-time guard (spec: a second POST while running -> HTTP 409)
# --------------------------------------------------------------------------- #
_demo_run_active = False


def is_demo_run_active() -> bool:
    """True while a demo driver task is running (module-level guard)."""
    return _demo_run_active


def mark_demo_run_active(active: bool) -> None:
    """Set / clear the one-run-at-a-time guard. The endpoint sets it; the driver clears it in `finally`."""
    global _demo_run_active
    _demo_run_active = active


def reset_demo_run_state() -> None:
    """Test helper: drop the run guard."""
    mark_demo_run_active(False)


# --------------------------------------------------------------------------- #
# Scripted, offline LLM client — SDK-shaped responses, dispatch on system prefix
# --------------------------------------------------------------------------- #
class ScriptedLLMClient:
    """Stands in for `AsyncAnthropic`: `client.messages.create(...)` returns a
    canned, SDK-shaped object (`.stop_reason == "end_turn"`, `.content` a list of
    `type="text"` blocks whose `.text` is one JSON object).

    Dispatch keys off the `system` prompt prefix — `"You are the Arbiter"` /
    `"...Berth/Vessel specialist"` / `"...Crane specialist"` / else the Yard
    specialist — so the real `bounded_json_call` path is exercised unchanged.
    """

    def __init__(self, script: dict[str, dict[str, Any]], step_delay: float) -> None:
        self._script = script
        self._delay = step_delay

    @property
    def messages(self) -> "ScriptedLLMClient":  # client.messages.create(...)
        return self

    async def create(self, *, system: str, **_: Any) -> SimpleNamespace:
        await asyncio.sleep(self._delay)
        if system.startswith("You are the Arbiter"):
            key = "arbiter"
        elif "Berth/Vessel specialist" in system:
            key = "berth"
        elif "Crane specialist" in system:
            key = "crane"
        elif "Yard specialist" in system:
            key = "yard"
        else:
            raise ValueError(
                "ScriptedLLMClient: unrecognised system prompt: " + system[:80]
            )
        text = json.dumps(self._script[key])
        return SimpleNamespace(
            stop_reason="end_turn",
            content=[SimpleNamespace(type="text", text=text)],
        )


# --------------------------------------------------------------------------- #
# Scripts
# --------------------------------------------------------------------------- #
def _spec_rec(agent: str, summary: str, actions: list[str], constraints: list[str], rationale: str) -> dict[str, Any]:
    return {
        "agent": agent,
        "summary": summary,
        "actions": actions,
        "constraints": constraints,
        "rationale": rationale,
    }


# Primary incident A — the three specialists genuinely disagree (crane assumes
# the discharge slip is absorbed; yard says C7-03 at 93% needs a reshuffle).
_SCRIPT_A: dict[str, dict[str, Any]] = {
    "berth": _spec_rec(
        "berth",
        "MSC Anna's berth window at B3 has slipped ~75 min; the clean recovery is to re-berth her "
        "against QC-04 once the crane picture is settled.",
        ["Release the B3 window for the following arrival", "Stage a re-berth against QC-04"],
        ["A re-berth only holds if QC-04 is confirmed workable"],
        "The slip exceeds the B3 buffer, so the window must be freed and a QC-04 re-berth staged.",
    ),
    "crane": _spec_rec(
        "crane",
        "QC-04 telemetry timed out during the handoff window; on last-known state it can still take "
        "the discharge, and the slip is absorbed within the shift.",
        ["Work QC-04 from last-known state", "Keep the current discharge sequence"],
        ["QC-04 telemetry is degraded — verify before committing moves"],
        "If QC-04's reported state holds, the discharge plan needs no yard-side change.",
    ),
    "yard": _spec_rec(
        "yard",
        "C7-03 is at ~93% utilisation; any QC-04 reroute concentrates moves there and forces a "
        "reshuffle the crane read does not account for.",
        ["Pre-stage a reshuffle on C7-03", "Hold reefer slots clear for diverted moves"],
        ["Keep C7-03 under 85% to preserve the reshuffle lane"],
        "The block is near capacity, so the crane's 'absorbed' assumption does not survive contact with the yard.",
    ),
    # Top option is DG-involved -> the DG hard gate fires and the re-plan loop runs.
    "arbiter": {
        "options": [
            {
                "description": "Swap MSC Anna's berth window with the DG box vessel at B3 and re-berth via QC-04",
                "predicted_impact": {
                    "delay_min": 45,
                    "cost": "medium",
                    "yard_impact": "C7-03 reshuffle deferred behind the swap",
                    "risk": "medium",
                },
                "reversible": False,
                "dg_involved": True,
            }
        ],
        "specialist_disagreement": True,
        "disagreement_summary": "crane assumes discharge absorbed; yard says C7 at 93% needs a reshuffle",
    },
}

# DG re-plan closure options (spec Design Notes): a DG option once, then a
# non-DG risk="high" option so the loop logs one violation per attempt and lands
# on a held Tier-3 non-DG recommendation (no DG bypass on operator approve).
_DG_REPLAN_OPTION = RecoveryOption(
    option_id="opt-1",
    description="Re-berth through QC-04 with the DG box vessel held alongside at B3",
    predicted_impact=PredictedImpact(
        delay_min=50, cost="medium", yard_impact="C7-03 reshuffle deferred", risk="medium"
    ),
    reversible=False,
    dg_involved=True,
)
# Non-DG, risk="high", cost="high" -> Tier 3. A second, low-delay alternative
# gives the outcome spread that adds the variance penalty, so confidence lands
# at ~65 (100 -15 fallback field -10 disagreement -10 variance).
_NON_DG_PRIMARY = RecoveryOption(
    option_id="opt-1",
    description="Hold MSC Anna at anchorage for 90 min and re-run the berth plan once QC-04 telemetry clears",
    predicted_impact=PredictedImpact(
        delay_min=90,
        cost="high",
        yard_impact="C7-03 stays at ~93%; reshuffle deferred to the next window",
        risk="high",
    ),
    reversible=True,
    dg_involved=False,
)
_NON_DG_ALT = RecoveryOption(
    option_id="opt-2",
    description="Divert two QC-04 moves to QC-05 and keep the current berth window",
    predicted_impact=PredictedImpact(
        delay_min=20, cost="medium", yard_impact="minor spillover to C7-04", risk="medium"
    ),
    reversible=True,
    dg_involved=False,
)

_DISAGREEMENT_SUMMARY = (
    "crane assumes discharge absorbed; yard says C7 at 93% needs a reshuffle"
)

# Concurrent incident B — a yard/gate squeeze; the specialists are aligned and
# there is one low-risk, low-cost, reversible, non-DG option -> auto-resolves.
_SCRIPT_B: dict[str, dict[str, Any]] = {
    "berth": _spec_rec(
        "berth",
        "No berth-side exposure — the congestion is entirely yard and gate side.",
        ["Hold the current berth plan"],
        [],
        "Nothing in the berth schedule is affected by the C7-05 reefer build-up.",
    ),
    "crane": _spec_rec(
        "crane",
        "Quay cranes are clear; the constraint is ground moves feeding C7-05, not the crane rail.",
        ["No crane action beyond monitoring"],
        [],
        "Crane capacity is not the bottleneck here, so the fix belongs to the yard and gate side.",
    ),
    "yard": _spec_rec(
        "yard",
        "C7-05 is trending to ~88%; shifting ~40 reefer moves to C7-06 and staggering gate G4 "
        "appointments clears it with room to spare.",
        ["Shift ~40 reefer moves from C7-05 to C7-06", "Stagger the next hour of G4 appointments"],
        [],
        "C7-06 has slack and G4 arrivals can be spread, so a light rebalance is enough.",
    ),
    "arbiter": {
        "options": [
            {
                "description": "Shift ~40 reefer moves from C7-05 to C7-06 and stagger G4 gate appointments",
                "predicted_impact": {
                    "delay_min": 15,
                    "cost": "low",
                    "yard_impact": "C7-05 eases to ~80%; C7-06 rises to ~60%",
                    "risk": "low",
                },
                "reversible": True,
                "dg_involved": False,
            }
        ],
        "specialist_disagreement": False,
        "disagreement_summary": "",
    },
}


# --------------------------------------------------------------------------- #
# Incident creation — the only legal creator is IncidentRegistry.correlate()
# --------------------------------------------------------------------------- #
def _prepend_ingest(incident: Incident, signal: Signal, received_at: datetime) -> None:
    """Stamp an `INGEST` entry a moment before the `CORRELATE` entry `correlate()` appended.

    The rail sorts entries by timestamp, so an earlier `INGEST` timestamp is all
    that is needed for it to render first.
    """
    ingest = TraceEntry(
        stage="INGEST",
        timestamp=(received_at - timedelta(seconds=1)).isoformat(),
        detail={"signal_type": signal.signal_type, "entity_refs": list(signal.entity_refs)},
    )
    incident.trace.insert(0, ingest)


def create_primary_incident() -> Incident:
    """Create incident A synchronously so the endpoint can return its id.

    Builds A's `Signal` directly (like `test_concurrent_incidents.py:_correlate`),
    emits `INGEST` just before `CORRELATE`, then registers it through the
    process-global registry.
    """
    registry = get_registry()
    received_at = datetime.now(timezone.utc)
    signal = Signal(
        entity_refs=["vessel:MSC-ANNA", "berth:B3", "crane:QC-04", "yard:C7-03"],
        signal_type="berth_window_conflict",
        payload={
            "berth_window_slip_min": 75,
            "crane": "QC-04 telemetry timeout in the handoff window",
            "yard_block_utilization": {"C7-03": 0.93},
        },
        received_at=received_at.isoformat(),
    )
    incident = registry.correlate(signal).incident
    _prepend_ingest(incident, signal, received_at)
    return incident


def _create_secondary_incident() -> Incident:
    """Create incident B (the concurrent yard/gate squeeze) via the same legal path.

    B's entity refs are disjoint from A's so correlation keeps them independent.
    """
    registry = get_registry()
    received_at = datetime.now(timezone.utc)
    signal = Signal(
        entity_refs=["yard:C7-05", "gate:G4"],
        signal_type="yard_congestion",
        payload={
            "yard_block_utilization": {"C7-05": 0.88},
            "gate": "G4 reefer appointment bunching",
        },
        received_at=received_at.isoformat(),
    )
    incident = registry.correlate(signal).incident
    _prepend_ingest(incident, signal, received_at)
    return incident


# --------------------------------------------------------------------------- #
# The driver
# --------------------------------------------------------------------------- #
async def _record_agent_calls(incident: Incident, bundle: Any, step_delay: float) -> None:
    """AD-19 recipe (`dispatch.py:107-116`): expose the bundle read-only and append
    one `AGENT_CALL` trace entry per recommendation, spaced by a short sleep so
    the poll catches the fan-out filling in. The crane call carries the
    telemetry-timeout fallback so the roster shows a `fallback` chip and the
    rail a `FALLBACK` flag.
    """
    incident.agents = [rec.model_dump() for rec in bundle.recommendations]
    for rec in bundle.recommendations:
        await asyncio.sleep(step_delay * 0.4)
        if rec.agent == "crane":
            append_trace(
                incident,
                "AGENT_CALL",
                {"agent": "crane", "mock_forced": False},
                error=error_shape(
                    "AGENT_CALL", "telemetry timeout", retried=True, fallback_used=True
                ),
            )
        else:
            append_trace(incident, "AGENT_CALL", {"agent": rec.agent, "mock_forced": False})


async def _run_primary(incident: Incident, step_delay: float) -> None:
    """Drive incident A: specialists (crane falls back) -> arbiter (DG top option)
    -> real DG re-plan loop -> held Tier-3 non-DG recommendation.
    """
    client = ScriptedLLMClient(_SCRIPT_A, step_delay)

    await asyncio.sleep(step_delay)  # INGEST / CORRELATE settle on the rail
    bundle = await run_specialists(incident, client=client)
    await _record_agent_calls(incident, bundle, step_delay)

    await asyncio.sleep(step_delay)
    append_trace(incident, "SYNTHESIZE", {})
    arbiter_result = await synthesize_options(incident, bundle, client=client)

    await asyncio.sleep(step_delay)

    attempts = {"n": 0}

    async def replan() -> ArbiterResult:
        attempts["n"] += 1
        if attempts["n"] < 2:
            options = [_DG_REPLAN_OPTION]
        else:
            options = [_NON_DG_PRIMARY, _NON_DG_ALT]
        return ArbiterResult(
            options=options,
            specialist_disagreement=True,
            disagreement_summary=_DISAGREEMENT_SUMMARY,
        )

    await run_policy_and_execution(
        incident,
        arbiter_result,
        replan=replan,
        fallback_field_count=1,
        staleness_seconds=0,
    )


async def _run_secondary(step_delay: float) -> None:
    """Drive incident B concurrently through the same real chain -> auto-resolves to VERIFY."""
    incident = _create_secondary_incident()
    client = ScriptedLLMClient(_SCRIPT_B, step_delay)

    await asyncio.sleep(step_delay)
    bundle = await run_specialists(incident, client=client)
    await _record_agent_calls(incident, bundle, step_delay)

    await asyncio.sleep(step_delay)
    append_trace(incident, "SYNTHESIZE", {})
    arbiter_result = await synthesize_options(incident, bundle, client=client)

    await asyncio.sleep(step_delay)
    await run_policy_and_execution(
        incident,
        arbiter_result,
        fallback_field_count=0,
        staleness_seconds=0,
    )


async def _run_secondary_after_delay(step_delay: float) -> None:
    await asyncio.sleep(step_delay * 3)
    await _run_secondary(step_delay)


async def run_three_way_disruption_demo(primary: Incident, *, step_delay: float = 2.0) -> None:
    """Run incident A to a held Tier-3 hold and, ~3*step_delay in, incident B
    concurrently to VERIFY. Always clears the one-run-at-a-time guard.

    A driver exception is caught and logged so a partial trace is left intact and
    the guard is still released.
    """
    try:
        await asyncio.gather(
            _run_primary(primary, step_delay),
            _run_secondary_after_delay(step_delay),
        )
    except Exception as exc:  # noqa: BLE001 - a demo run must never wedge the guard
        print(f"[portwatch-api] three-way-disruption demo driver error: {type(exc).__name__}: {exc}")
        append_trace(
            primary,
            "ERROR",
            {},
            error=error_shape("ERROR", f"{type(exc).__name__}: {exc}"),
        )
    finally:
        mark_demo_run_active(False)
