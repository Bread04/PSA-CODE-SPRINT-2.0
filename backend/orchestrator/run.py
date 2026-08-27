"""Orchestrator: wires Stories 1.5-1.12 into the per-incident execution flow.

This is the single module that owns one `Incident` at a time (AD-4). It takes
the already-synthesised `ArbiterResult` (Story 1.4) plus the incident record and
runs the deterministic policy stack in dependency order:

  1.12 trace  -> record the start of policy work
  1.6  confidence -> `ConfidencePenalties.from_inputs` + `compute_confidence`
  1.7  tier    -> `classify_tier(option, confidence)`
  1.9  DG gate -> `dg_violation` / `dg_rejection_reason`, bounded re-plan loop
  1.10 kill switch -> checked at exactly one point, before mock-service execution
  1.11 execution -> `build_registry` + `execute_action` through `with_retry` (1.5)
  1.8  tier execution paths -> Tier 1 dispatches + verifies; Tier 2 adds a
       non-blocking notification; Tier 3 is held for human approval (often DG-forced)

The function is async and pure of any network / SDK dependency: the caller
injects `execute_registry` (a mock-service registry, Story 1.11) and, for the
DG re-plan loop, a `replan` coroutine that returns a fresh `ArbiterResult`.
`run_policy_and_execution` returns a small dict so tests can assert on the
`tier`, an optional `decision_card` (Tier 3), and `execution_results`.

Story 1.13 (mock override) is supported two ways: `call_specialist` short-circuits
on `is_mock_forced`, and `run_policy_and_execution` accepts a `mock_forced` flag
that (a) bumps the confidence fallback penalty and (b) is recorded on the
AGENT_CALL trace by the upstream specialist runner.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Awaitable, Callable

from pydantic import BaseModel

from models.incident import Incident
from models.recovery import RecoveryOption
from agents.arbiter import ArbiterResult
from policy.confidence import compute_confidence, ConfidencePenalties
from policy.engine import classify_tier
from policy.dg_gate import dg_rejection_reason, dg_violation, MAX_DG_REPLAN_ATTEMPTS
from policy.killswitch import is_kill_switch_engaged
from orchestrator.retry import RetryResult, with_retry
from orchestrator.trace import append_trace, error_shape
from mock_services.services import build_registry, execute_action


class ExecutionError(RuntimeError):
    """Raised when an action's execution fails, so Story 1.5 retry/fallback fires."""


async def _execute_action_with_failures(action: dict, registry: Any) -> list[dict]:
    """Run `execute_action`; raise on any failed call so the retry boundary triggers.

    Per-call outcomes are still recorded by `execute_action` (it never swallows a
    failure) - this wrapper only converts an action-level failure into a raise that
    `with_retry` recognizes, instead of letting the action read as a silent success.
    """
    results = await execute_action(action, registry)
    failed = [r for r in results if not r.get("ok")]
    if failed:
        raise ExecutionError(f"{len(failed)} of {len(results)} call(s) failed to execute")
    return results


class DecisionCard(BaseModel):
    """The operator-facing summary for a Tier 3 action held for approval (Story 1.8)."""

    incident_id: str
    situation: str
    recommendation: str
    predicted_impact: dict[str, Any]
    confidence: int
    alternatives: list[str]


def _staleness_seconds(incident: Incident) -> int:
    """Seconds since `last_signal_at`; 0 when unparseable (never a penalty source)."""
    try:
        last = datetime.fromisoformat(incident.last_signal_at)
        if last.tzinfo is None:
            last = last.replace(tzinfo=timezone.utc)
        return int((datetime.now(timezone.utc) - last).total_seconds())
    except Exception:
        return 0


def _outcome_spread_exceeds(options: list[RecoveryOption]) -> bool:
    """True when the predicted-delay spread across options exceeds the 30% guard (Story 1.6)."""
    delays = [opt.predicted_impact.delay_min for opt in options]
    if len(delays) < 2 or max(delays) == 0:
        return False
    return (max(delays) - min(delays)) > 0.30 * max(delays)


def _option_to_action(option: RecoveryOption) -> dict[str, Any]:
    """Map a `RecoveryOption` to the mock-service call plan (Story 1.11).

    Every option dispatches a TOS record; a DG-affected option also gates a
    `dg_checker` pre-check so the execution layer sees the DG dependency.
    """
    calls = [{"service": "tos", "payload": {"option_id": option.option_id, "description": option.description}}]
    if option.dg_involved:
        calls.append({"service": "dg_checker", "payload": {"option_id": option.option_id}})
    return {"calls": calls}


def _build_card(incident: Incident, selected: RecoveryOption) -> DecisionCard:
    alternatives = [opt.description for opt in incident.options if opt.option_id != selected.option_id]
    situation = ", ".join(incident.entity_refs) if incident.entity_refs else incident.incident_id
    return DecisionCard(
        incident_id=incident.incident_id,
        situation=situation,
        recommendation=selected.description,
        predicted_impact=selected.predicted_impact.model_dump(),
        confidence=incident.confidence,
        alternatives=alternatives,
    )


def _apply_options(
    incident: Incident,
    arbiter_result: ArbiterResult,
    *,
    staleness_seconds: int,
    fallback_field_count: int,
    mock_forced: bool,
) -> tuple[RecoveryOption | None, int]:
    """Stamp options, score confidence, classify tier; returns (selected_option, tier)."""
    incident.options = arbiter_result.options
    incident.recommended_option_id = arbiter_result.options[0].option_id if arbiter_result.options else None

    penalties = ConfidencePenalties.from_inputs(
        staleness_seconds=staleness_seconds,
        fallback_fields=fallback_field_count,
        mock_forced=mock_forced,
        disagreement=arbiter_result.specialist_disagreement,
        variance_exceeds=_outcome_spread_exceeds(arbiter_result.options),
    )
    incident.confidence = compute_confidence(penalties)
    append_trace(
        incident,
        "CONFIDENCE",
        {
            "confidence": incident.confidence,
            "staleness_seconds": staleness_seconds,
            "fallback_fields": fallback_field_count,
            "mock_forced": mock_forced,
            "disagreement": arbiter_result.specialist_disagreement,
            "variance_exceeds": _outcome_spread_exceeds(arbiter_result.options),
        },
    )

    selected = incident.options[0] if incident.options else None
    tier = classify_tier(selected, incident.confidence) if selected is not None else 3
    incident.tier = tier
    append_trace(incident, "POLICY_DECISION", {"tier": tier})
    return selected, tier


async def _execute_selected(
    incident: Incident,
    selected: RecoveryOption,
    tier: int,
    *,
    execute_registry: Any | None,
    fallback_field_count: int,
    mock_forced: bool,
) -> list[dict[str, Any]]:
    """Dispatch a Tier 1/2 option; Story 1.10 kill switch is checked here, and only here."""
    if is_kill_switch_engaged():
        incident.blocked_by_kill_switch = True
        append_trace(
            incident,
            "EXECUTE",
            {"tier": tier, "blocked": True},
            error=error_shape("EXECUTE", "global kill switch engaged", retried=False, fallback_used=False),
        )
        return []

    action = _option_to_action(selected)
    registry = execute_registry if execute_registry is not None else build_registry()
    result: RetryResult = await with_retry(lambda: _execute_action_with_failures(action, registry))
    results: list[dict[str, Any]] = result.value if result.value is not None else []

    append_trace(
        incident,
        "EXECUTE",
        {
            "tier": tier,
            "results": results,
            "retried": result.retried,
            "fallback_used": result.fallback_used,
            "mock_forced": mock_forced,
            "fallback_fields": fallback_field_count,
        },
    )
    if tier == 2:
        # Non-blocking operator notification: informational only, never gates the action.
        append_trace(incident, "NOTIFY", {"channel": "operator", "non_blocking": True})

    all_ok = bool(results) and all(call.get("ok") for call in results)
    append_trace(incident, "VERIFY", {"all_ok": all_ok})
    if all_ok:
        incident.status = "resolved"
    return results


async def run_policy_and_execution(
    incident: Incident,
    arbiter_result: ArbiterResult,
    *,
    execute_registry: Any | None = None,
    replan: Callable[[], Awaitable[ArbiterResult]] | None = None,
    staleness_seconds: int | None = None,
    fallback_field_count: int = 0,
    mock_forced: bool = False,
) -> dict[str, Any]:
    """Run the full deterministic policy + execution stack for one incident.

    Returns `{"tier", "decision_card"|None, "execution_results"|None}`. The
    incident is mutated in place: `options`, `recommended_option_id`,
    `confidence`, `tier`, `status`, `blocked_by_kill_switch`, and `trace`.
    """
    staleness = staleness_seconds if staleness_seconds is not None else _staleness_seconds(incident)
    append_trace(incident, "POLICY_START", {"mock_forced": mock_forced})

    selected, tier = _apply_options(
        incident,
        arbiter_result,
        staleness_seconds=staleness,
        fallback_field_count=fallback_field_count,
        mock_forced=mock_forced,
    )

    # Story 1.9 DG gate: bounded re-plan loop. Re-classify to Tier 3 only when the
    # gate cannot be satisfied within MAX_DG_REPLAN_ATTEMPTS, never on the first violation.
    dg_attempts = 0
    while selected is not None and dg_violation(selected):
        append_trace(
            incident,
            "DG_CHECK",
            {"violation": True, "reason": dg_rejection_reason(selected)},
            error=error_shape("DG_CHECK", dg_rejection_reason(selected), retried=False, fallback_used=False),
        )
        if replan is None or dg_attempts >= MAX_DG_REPLAN_ATTEMPTS:
            incident.tier = 3
            tier = 3
            selected = None
            break
        dg_attempts += 1
        new_result = await replan()
        selected, tier = _apply_options(
            incident,
            new_result,
            staleness_seconds=staleness,
            fallback_field_count=fallback_field_count,
            mock_forced=mock_forced,
        )

    if selected is not None and not dg_violation(selected):
        append_trace(incident, "DG_CHECK", {"violation": False})

    decision_card: DecisionCard | None = None
    execution_results: list[dict[str, Any]] | None = None

    if tier == 3:
        incident.approval_status = "pending"
        if selected is not None:
            decision_card = _build_card(incident, selected)
        append_trace(
            incident,
            "APPROVAL",
            {"blocked": True, "tier": 3, "dg_forced": dg_attempts > 0, "card": decision_card.model_dump() if decision_card else None},
        )
    else:
        if selected is None:
            # DG gate forced Tier 3 but left no chosen option to execute.
            incident.approval_status = "pending"
            append_trace(incident, "APPROVAL", {"blocked": True, "tier": 3, "dg_forced": True})
        else:
            execution_results = await _execute_selected(
                incident,
                selected,
                tier,
                execute_registry=execute_registry,
                fallback_field_count=fallback_field_count,
                mock_forced=mock_forced,
            )

    return {"tier": tier, "decision_card": decision_card, "execution_results": execution_results}


async def approve_incident(
    incident: Incident,
    *,
    execute_registry: Any | None = None,
) -> dict[str, Any]:
    """Approve a held Tier 3 action (Story 1.8). Re-checks the kill switch first (Story 1.10)."""
    if incident.tier != 3:
        return {"approved": False, "reason": "only tier 3 requires approval"}

    if incident.blocked_by_kill_switch:
        if is_kill_switch_engaged():
            append_trace(
                incident,
                "EXECUTE",
                {"blocked": True},
                error=error_shape("EXECUTE", "kill switch still engaged on approve", retried=False, fallback_used=False),
            )
            return {"approved": False, "reason": "kill switch engaged"}
        # Switch was disengaged after blocking; clear the flag and proceed.
        incident.blocked_by_kill_switch = False

    incident.approval_status = "approved"
    selected = next((opt for opt in incident.options if opt.option_id == incident.recommended_option_id), None)
    if selected is None:
        return {"approved": True, "execution_results": []}

    results = await _execute_selected(
        incident, selected, 3, execute_registry=execute_registry, fallback_field_count=0, mock_forced=False
    )
    return {"approved": True, "execution_results": results}
