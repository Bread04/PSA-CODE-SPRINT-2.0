"""Spec 3.2: deterministic proof that a Pasir Panjang P2 reroute option is
offered *only* under Tuas C7 pressure, driven through the real, unchanged
pipeline (`dispatch.run_specialists` -> `dispatch.synthesize_options` ->
`orchestrator.run.run_policy_and_execution`).

Source of truth: _bmad-output/implementation-artifacts/spec-3-2-pasir-panjang-load-balancing.md.

Design (mirrors Story 3.1's proof pattern)
------------------------------------------
* The incident is created the only legal way - `IncidentRegistry.correlate()`
  from a `Signal` whose `payload["yard_utilization"]` carries the two-block
  figures. `correlate()` deep-copies that onto the `CORRELATE` trace entry and
  `_incident_summary()` renders it into the specialist brief unchanged - the
  only channel for utilization data.
* One `FakeAsyncAnthropic` (the `test_arbiter.py` shape) answers every call:
    - each specialist gets a valid `SpecialistRecommendation`;
    - the YARD responder parses `yard_utilization` back out of the brief and
      emits a `propose_yard_regrade ... to Pasir Panjang P2` action **iff the
      real `should_offer_pasir_panjang(util)` is True** - the conditionality is
      the helper's, not a hard-coded canned string;
    - the ARBITER responder forwards each yard action verbatim into a
      `RecoveryOption` description.
* HIGH and LOW payloads run through *identical* responder logic; the option's
  presence / absence is therefore driven by the helper, which is itself
  unit-tested at the threshold boundary in tests/agents/test_yard_load_balancing.py.
* No production code is modified. The pipeline is driven directly (never through
  api/state.py). Globals are reset first.
"""

from __future__ import annotations

import asyncio
import json

from agents import dispatch
from agents import yard as yard_agent
from agents.mock_override import reset_mock_agents
from agents.yard_load_balancing import should_offer_pasir_panjang

from models.signal import Signal

from registry.incident_registry import IncidentRegistry

from policy.killswitch import reset_kill_switch_for_tests

from orchestrator.run import run_policy_and_execution
from orchestrator.trace import STAGES

from mock_services.services import build_registry

BASE_TIME = "2026-08-27T10:00:00Z"

HIGH_TUAS = {"tuas_c7": 0.93, "pasir_panjang_p2": 0.44}
LOW_TUAS = {"tuas_c7": 0.55, "pasir_panjang_p2": 0.40}


# --------------------------------------------------------------------------- #
# Fake Anthropic client - same shape as tests/agents/test_arbiter.py
# --------------------------------------------------------------------------- #
class _Block:
    def __init__(self, block_type: str, text: str | None = None) -> None:
        self.type = block_type
        self.text = text


class _Response:
    def __init__(self, content: list, stop_reason: str = "end_turn") -> None:
        self.content = content
        self.stop_reason = stop_reason


class _Messages:
    def __init__(self, parent: "FakeAsyncAnthropic") -> None:
        self._parent = parent

    async def create(self, **kwargs):
        self._parent.calls.append(kwargs)
        await asyncio.sleep(0)
        return self._parent._responder(kwargs)


class FakeAsyncAnthropic:
    def __init__(self, responder) -> None:
        self.calls: list[dict] = []
        self._responder = responder
        self.messages = _Messages(self)


def _text_response(payload: dict) -> _Response:
    return _Response([_Block("text", json.dumps(payload))])


# --------------------------------------------------------------------------- #
# Brief / bundle parsing helpers used by the canned responders
# --------------------------------------------------------------------------- #
def _extract_yard_utilization(text: str) -> dict:
    """Pull `yard_utilization` back out of a rendered incident brief.

    The brief renders the correlated signal payload as
    `payload: {"yard_utilization": {"pasir_panjang_p2": 0.44, "tuas_c7": 0.93}}`.
    """
    marker = '"yard_utilization"'
    idx = text.find(marker)
    if idx == -1:
        return {}
    brace = text.rfind("{", 0, idx)
    if brace == -1:
        return {}
    try:
        obj, _ = json.JSONDecoder().raw_decode(text, brace)
    except json.JSONDecodeError:
        return {}
    util = obj.get("yard_utilization") if isinstance(obj, dict) else None
    return util if isinstance(util, dict) else {}


def _specialist_analyses(content: str) -> list[dict]:
    """Decode the `<specialist-analyses>` JSON array from the arbiter user message."""
    open_tag, close_tag = "<specialist-analyses>", "</specialist-analyses>"
    # The prose preamble also contains the literal "<specialist-analyses>" phrase;
    # the real fenced block is the LAST open tag before the (single) close tag.
    end = content.find(close_tag)
    start = content.rfind(open_tag, 0, end)
    if start == -1 or end == -1:
        return []
    block = content[start + len(open_tag):end].strip()
    try:
        data = json.loads(block)
    except json.JSONDecodeError:
        return []
    return [r for r in data if isinstance(r, dict)] if isinstance(data, list) else []


# --------------------------------------------------------------------------- #
# The single responder: specialists + arbiter, keyed on the system prompt
# --------------------------------------------------------------------------- #
def _responder(kwargs: dict):
    system = kwargs.get("system", "")
    content = kwargs["messages"][0]["content"]

    if "You are the Arbiter" in system:
        yard_actions: list[str] = []
        for rec in _specialist_analyses(content):
            if rec.get("agent") == "yard":
                yard_actions = [a for a in rec.get("actions", []) if isinstance(a, str) and a.strip()]
        options = [
            {
                "description": action,
                "predicted_impact": {
                    "delay_min": 40,
                    "cost": "medium",
                    "yard_impact": "Tuas C7 relieved; Pasir Panjang P2 absorbs the diverted flow",
                    "risk": "low",
                },
                "reversible": True,
                "dg_involved": False,
            }
            for action in yard_actions
        ]
        return _text_response(
            {"options": options, "specialist_disagreement": False, "disagreement_summary": ""}
        )

    # --- specialist calls -------------------------------------------------- #
    if "You are the Yard specialist" in system:
        agent = "yard"
        util = _extract_yard_utilization(content)
        if should_offer_pasir_panjang(util):
            actions = [
                "propose_yard_regrade: move ~600 TEU of import flow from Tuas C7 "
                "to Pasir Panjang P2 to relieve congestion"
            ]
        else:
            actions = [
                "Rebalance reefer stacks within Tuas C7; no cross-terminal move required"
            ]
        rationale = (
            "Yard-block occupancy on the correlated signal drives the choice: a "
            "cross-terminal regrade is only proposed when Tuas C7 is under pressure "
            "and Pasir Panjang P2 has headroom."
        )
    elif "You are the Berth/Vessel specialist" in system:
        agent = "berth"
        actions = ["Hold the current berth window; no vessel move needed for a yard-side congestion event"]
        rationale = "This is a yard-congestion incident; berth scheduling is unaffected."
    elif "You are the Crane specialist" in system:
        agent = "crane"
        actions = ["Keep the current crane allocation; monitor move rate during any yard regrade"]
        rationale = "No crane fault present; crane throughput is not the constraint here."
    else:  # pragma: no cover - defensive
        raise AssertionError(f"unexpected specialist system prompt: {system[:60]!r}")

    return _text_response(
        {
            "agent": agent,
            "summary": f"{agent} assessment of the yard-congestion disruption.",
            "actions": actions,
            "constraints": [],
            "rationale": rationale,
        }
    )


# --------------------------------------------------------------------------- #
# Pipeline drive
# --------------------------------------------------------------------------- #
def _reset_globals() -> None:
    reset_kill_switch_for_tests()
    reset_mock_agents()


def _correlate_yard_incident(util: dict, ref_suffix: str):
    reg = IncidentRegistry()
    signal = Signal(
        entity_refs=[f"yard:TUAS-C7-{ref_suffix}", f"yard:PASIR-PANJANG-P2-{ref_suffix}"],
        signal_type="yard_congestion",
        payload={"yard_utilization": util, "congestion_level": "high"},
        received_at=BASE_TIME,
    )
    return reg.correlate(signal).incident


async def _drive(util: dict, ref_suffix: str):
    fake = FakeAsyncAnthropic(_responder)
    incident = _correlate_yard_incident(util, ref_suffix)
    bundle = await dispatch.run_specialists(incident, client=fake)
    arbiter_result = await dispatch.synthesize_options(incident, bundle, client=fake)
    result = await run_policy_and_execution(
        incident,
        arbiter_result,
        execute_registry=build_registry(),
        staleness_seconds=0,
    )
    return incident, arbiter_result, result


# --------------------------------------------------------------------------- #
# I/O matrix row: HIGH_TUAS
# --------------------------------------------------------------------------- #
def test_high_tuas_offers_pasir_panjang_reroute_through_real_pipeline():
    _reset_globals()
    assert should_offer_pasir_panjang(HIGH_TUAS) is True

    incident, arbiter_result, result = asyncio.run(_drive(HIGH_TUAS, "HIGH"))

    pasir_options = [
        o for o in arbiter_result.options if "Pasir Panjang" in o.description
    ]
    assert len(pasir_options) == 1, (
        f"expected exactly one Pasir Panjang option, got "
        f"{[o.description for o in arbiter_result.options]}"
    )

    # Flowed through policy/tier/execution with no new pipeline stage. The canned
    # option (delay 40, cost medium, risk low, reversible, no DG) classifies
    # deterministically to Tier 2 - pinned, no tautology, no conditional skip.
    assert {e.stage for e in incident.trace} <= set(STAGES)
    assert incident.tier == 2
    assert incident.status == "resolved"
    assert result["execution_results"] is not None
    assert all(r.get("ok") for r in result["execution_results"])


# --------------------------------------------------------------------------- #
# I/O matrix row: LOW_TUAS
# --------------------------------------------------------------------------- #
def test_low_tuas_does_not_offer_pasir_panjang_but_still_resolves():
    _reset_globals()
    assert should_offer_pasir_panjang(LOW_TUAS) is False

    incident, arbiter_result, result = asyncio.run(_drive(LOW_TUAS, "LOW"))

    assert not any("Pasir Panjang" in o.description for o in arbiter_result.options)

    # Same canned option shape as HIGH_TUAS -> deterministically Tier 2, resolved.
    assert {e.stage for e in incident.trace} <= set(STAGES)
    assert incident.tier == 2
    assert incident.status == "resolved"
    assert result["execution_results"] is not None
    assert all(r.get("ok") for r in result["execution_results"])


# --------------------------------------------------------------------------- #
# Same responder logic, both payloads: the option is condition-gated, not forced
# --------------------------------------------------------------------------- #
def test_conditionality_is_driven_by_the_helper_not_a_canned_string():
    _reset_globals()
    _, high_arb, _ = asyncio.run(_drive(HIGH_TUAS, "GATE-HIGH"))
    _reset_globals()
    _, low_arb, _ = asyncio.run(_drive(LOW_TUAS, "GATE-LOW"))

    high_has = any("Pasir Panjang" in o.description for o in high_arb.options)
    low_has = any("Pasir Panjang" in o.description for o in low_arb.options)
    assert high_has and not low_has


# --------------------------------------------------------------------------- #
# Reuse-unchanged evidence: the yard manifest already names both blocks
# --------------------------------------------------------------------------- #
def test_yard_tool_manifest_names_both_blocks_unchanged():
    manifest_text = json.dumps(yard_agent.TOOL_MANIFEST)
    assert "Tuas C7" in manifest_text
    assert "Pasir Panjang P2" in manifest_text
