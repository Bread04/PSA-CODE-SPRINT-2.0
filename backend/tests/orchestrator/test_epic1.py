"""Epic 1 integration + unit tests for the deterministic policy stack.

Stories covered: 1.5 (retry), 1.6 (confidence), 1.7 (tier), 1.8 (cards/approve),
1.9 (DG gate), 1.10 (kill switch), 1.11 (mock execution), 1.12 (trace),
1.13 (mock override).

These tests are pure and offline: they import the real modules and drive them
with in-memory `Incident` / `RecoveryOption` records and the mock-service
registry. No network and no ANTHROPIC_API_KEY are used.
"""

from __future__ import annotations

import asyncio

from models.incident import Incident
from models.recovery import PredictedImpact, RecoveryOption

from agents.arbiter import ArbiterResult
from agents.mock_override import (
    canned_arbiter,
    is_mock_forced,
    reset_mock_agents,
    set_mock_agents,
)

from policy.confidence import BASE_CONFIDENCE, ConfidencePenalties, compute_confidence
from policy.dg_gate import (
    MAX_DG_REPLAN_ATTEMPTS,
    dg_rejection_reason,
    dg_violation,
)
from policy.engine import SLA_DELAY_THRESHOLD_MIN, classify_tier, sla_breached
from policy.killswitch import (
    disengage_kill_switch,
    engage_kill_switch,
    is_kill_switch_engaged,
    reset_kill_switch_for_tests,
)

from orchestrator.retry import RetryResult, with_retry
from orchestrator.run import approve_incident, run_policy_and_execution
from orchestrator.trace import STAGES, append_trace, error_shape, now_utc

from mock_services.services import build_registry, execute_action


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
def _opt(
    *,
    reversible: bool = True,
    risk: str = "low",
    cost: str = "low",
    delay: int = 30,
    dg: bool = False,
    option_id: str = "opt-1",
    description: str = "recover in place",
) -> RecoveryOption:
    return RecoveryOption(
        option_id=option_id,
        description=description,
        predicted_impact=PredictedImpact(delay_min=delay, cost=cost, yard_impact="minor", risk=risk),
        reversible=reversible,
        dg_involved=dg,
    )


def _arbiter(options, *, disagreement: bool = False, summary: str = "") -> ArbiterResult:
    # ArbiterResult requires a non-empty summary whenever disagreement is flagged.
    return ArbiterResult(
        options=options,
        specialist_disagreement=disagreement,
        disagreement_summary=summary if disagreement else summary,
    )


def _incident() -> Incident:
    stamp = now_utc()
    return Incident(incident_id="inc-1", created_at=stamp, last_signal_at=stamp)


# --------------------------------------------------------------------------- #
# Story 1.6: confidence scoring
# --------------------------------------------------------------------------- #
class TestConfidence:
    def test_base_is_100(self):
        assert compute_confidence(ConfidencePenalties()) == BASE_CONFIDENCE == 100

    def test_staleness_penalty(self):
        # 70s - 60s fresh window = 10s stale => 1pt penalty.
        assert compute_confidence(ConfidencePenalties(staleness_seconds=70)) == 99

    def test_staleness_capped_at_20(self):
        assert compute_confidence(ConfidencePenalties(staleness_seconds=500)) == 80

    def test_fallback_field_penalty(self):
        assert compute_confidence(ConfidencePenalties(fallback_field_count=1)) == 85
        assert compute_confidence(ConfidencePenalties(fallback_field_count=2)) == 70

    def test_mock_forced_counts_as_one_fallback_field(self):
        p = ConfidencePenalties.from_inputs(mock_forced=True)
        assert p.fallback_field_count == 1
        assert compute_confidence(p) == 85

    def test_disagreement_penalty(self):
        assert compute_confidence(ConfidencePenalties.from_inputs(disagreement=True)) == 90

    def test_variance_penalty(self):
        assert compute_confidence(ConfidencePenalties.from_inputs(variance_exceeds=True)) == 90

    def test_combined_penalties(self):
        p = ConfidencePenalties.from_inputs(fallback_fields=2, disagreement=True, variance_exceeds=True)
        # 100 - 30 - 10 - 10 = 50
        assert compute_confidence(p) == 50

    def test_floor_at_zero(self):
        assert compute_confidence(ConfidencePenalties(fallback_field_count=10)) == 0


# --------------------------------------------------------------------------- #
# Story 1.7: tier classification
# --------------------------------------------------------------------------- #
class TestEngine:
    def test_tier1_clean(self):
        assert classify_tier(_opt(), 100) == 1

    def test_tier1_requires_confidence_85(self):
        assert classify_tier(_opt(), 85) == 1
        assert classify_tier(_opt(), 84) == 2  # falls to Tier 2 floor

    def test_tier2_valid_medium_risk(self):
        assert classify_tier(_opt(risk="medium", cost="low"), 100) == 2

    def test_tier2_valid_medium_cost(self):
        assert classify_tier(_opt(risk="low", cost="medium"), 100) == 2

    def test_tier3_irreversible(self):
        assert classify_tier(_opt(reversible=False), 100) == 3

    def test_tier3_high_risk(self):
        assert classify_tier(_opt(risk="high"), 100) == 3

    def test_tier3_high_cost(self):
        assert classify_tier(_opt(cost="high"), 100) == 3

    def test_tier3_low_confidence(self):
        assert classify_tier(_opt(), 40) == 3

    def test_tier3_dg(self):
        assert classify_tier(_opt(dg=True), 100) == 3

    def test_tier3_sla_breach(self):
        assert classify_tier(_opt(delay=200), 100) == 3

    def test_sla_breached_helper(self):
        assert sla_breached(_opt(delay=200)) is True
        assert sla_breached(_opt(delay=30)) is False
        assert SLA_DELAY_THRESHOLD_MIN == 120


# --------------------------------------------------------------------------- #
# Story 1.9: DG gate
# --------------------------------------------------------------------------- #
class TestDGGate:
    def test_dg_violation_true(self):
        assert dg_violation(_opt(dg=True)) is True

    def test_dg_violation_false(self):
        assert dg_violation(_opt(dg=False)) is False

    def test_rejection_reason_mentions_dg(self):
        reason = dg_rejection_reason(_opt(dg=True))
        assert isinstance(reason, str)
        assert "DG" in reason.upper()

    def test_max_replan_attempts_is_two(self):
        assert MAX_DG_REPLAN_ATTEMPTS == 2


# --------------------------------------------------------------------------- #
# Story 1.10: kill switch
# --------------------------------------------------------------------------- #
class TestKillSwitch:
    def teardown_method(self):
        reset_kill_switch_for_tests()

    def test_engage_sets_engaged(self):
        engage_kill_switch()
        assert is_kill_switch_engaged() is True

    def test_disengage_clears(self):
        engage_kill_switch()
        disengage_kill_switch()
        assert is_kill_switch_engaged() is False

    def test_reset_for_tests_clears(self):
        engage_kill_switch()
        reset_kill_switch_for_tests()
        assert is_kill_switch_engaged() is False


# --------------------------------------------------------------------------- #
# Story 1.5: retry + fallback
# --------------------------------------------------------------------------- #
class TestRetry:
    def test_success_no_retry(self):
        async def ok():
            return "done"

        res = asyncio.run(with_retry(ok))
        assert isinstance(res, RetryResult)
        assert res.ok is True
        assert res.retried is False
        assert res.fallback_used is False
        assert res.value == "done"

    def test_retry_then_success(self):
        calls = {"n": 0}

        async def flaky():
            calls["n"] += 1
            if calls["n"] == 1:
                raise RuntimeError("first failure")
            return "recovered"

        res = asyncio.run(with_retry(flaky))
        assert res.ok is True
        assert res.retried is True
        assert res.fallback_used is False
        assert res.value == "recovered"

    def test_fallback_used_after_exhaustion(self):
        async def boom():
            raise RuntimeError("always fails")

        res = asyncio.run(with_retry(boom, fallback=lambda: "cached"))
        assert res.ok is False
        assert res.retried is True
        assert res.fallback_used is True
        assert res.value == "cached"

    def test_empty_state_used_when_no_fallback(self):
        async def boom():
            raise RuntimeError("always fails")

        res = asyncio.run(with_retry(boom, empty_state=[]))
        assert res.ok is False
        assert res.retried is True
        assert res.fallback_used is True
        assert res.value == []

    def test_exactly_one_retry_attempted(self):
        calls = {"n": 0}

        async def boom():
            calls["n"] += 1
            raise RuntimeError("x")

        asyncio.run(with_retry(boom, fallback=lambda: "f"))
        assert calls["n"] == 2  # initial attempt + exactly one retry


# --------------------------------------------------------------------------- #
# Story 1.12: trace
# --------------------------------------------------------------------------- #
class TestTrace:
    def test_now_utc_is_iso_string(self):
        stamp = now_utc()
        assert isinstance(stamp, str)
        assert "T" in stamp

    def test_stages_include_core_pipeline(self):
        assert "CONFIDENCE" in STAGES
        assert "POLICY_DECISION" in STAGES
        assert "DG_CHECK" in STAGES
        assert "APPROVAL" in STAGES

    def test_error_shape(self):
        err = error_shape("EXECUTE", "boom", retried=True, fallback_used=True)
        assert err == {"stage": "EXECUTE", "error": "boom", "retried": True, "fallback_used": True}

    def test_append_trace_adds_entry(self):
        inc = _incident()
        entry = append_trace(inc, "CORRELATE", {"signal": "berth"})
        assert len(inc.trace) == 1
        assert inc.trace[0].stage == "CORRELATE"
        assert inc.trace[0].detail == {"signal": "berth"}
        assert inc.trace[0].error is None
        assert entry.stage == "CORRELATE"


# --------------------------------------------------------------------------- #
# Story 1.11 + orchestrator integration
# --------------------------------------------------------------------------- #
class TestOrchestrator:
    def teardown_method(self):
        reset_kill_switch_for_tests()

    def test_tier1_executes_and_resolves(self):
        inc = _incident()
        res = asyncio.run(run_policy_and_execution(inc, _arbiter([_opt()])))
        assert res["tier"] == 1
        assert inc.status == "resolved"
        assert res["execution_results"][0]["ok"] is True
        assert res["execution_results"][0]["service"] == "tos"

    def test_tier2_executes_and_resolves(self):
        inc = _incident()
        opts = [_opt(risk="medium", cost="low")]
        res = asyncio.run(run_policy_and_execution(inc, _arbiter(opts)))
        assert res["tier"] == 2
        assert inc.status == "resolved"
        assert res["execution_results"][0]["ok"] is True

    def test_tier3_held_for_approval(self):
        inc = _incident()
        opts = [_opt(reversible=False)]
        res = asyncio.run(run_policy_and_execution(inc, _arbiter(opts)))
        assert res["tier"] == 3
        assert inc.approval_status == "pending"
        assert inc.status == "open"
        assert res["decision_card"] is not None

    def test_dg_without_replan_is_held_no_execution(self):
        inc = _incident()
        opts = [_opt(dg=True)]
        res = asyncio.run(run_policy_and_execution(inc, _arbiter(opts)))
        assert res["tier"] == 3
        assert res["execution_results"] is None
        assert res["decision_card"] is None
        assert inc.approval_status == "pending"

    def test_dg_with_replan_recovers_to_executable(self):
        inc = _incident()
        opts = [_opt(dg=True)]
        new_opts = [_opt(dg=False)]

        async def replan():
            return _arbiter(new_opts)

        res = asyncio.run(run_policy_and_execution(inc, _arbiter(opts), replan=replan))
        assert res["tier"] in (1, 2)
        assert inc.status == "resolved"
        assert res["execution_results"] is not None

    def test_kill_switch_blocks_tier1_execution(self):
        engage_kill_switch()
        inc = _incident()
        res = asyncio.run(run_policy_and_execution(inc, _arbiter([_opt()])))
        assert inc.blocked_by_kill_switch is True
        assert res["tier"] == 1  # classified, but not executed
        assert res["execution_results"] == []

    def test_execution_failure_leaves_incident_open(self):
        inc = _incident()
        failing = build_registry(failing={"tos"})
        res = asyncio.run(run_policy_and_execution(inc, _arbiter([_opt()]), execute_registry=failing))
        assert res["tier"] == 1
        assert inc.status == "open"
        assert res["execution_results"][0]["ok"] is False

    def test_mock_forced_reduces_confidence(self):
        inc = _incident()
        asyncio.run(run_policy_and_execution(inc, _arbiter([_opt()]), mock_forced=True))
        assert inc.confidence == 85  # 100 - 15 (one mock field)

    def test_staleness_reduces_confidence(self):
        inc = _incident()
        asyncio.run(run_policy_and_execution(inc, _arbiter([_opt()]), staleness_seconds=70))
        assert inc.confidence == 99  # 100 - 1

    def test_approve_incident_runs_held_action(self):
        inc = _incident()
        asyncio.run(run_policy_and_execution(inc, _arbiter([_opt(reversible=False)])))
        assert inc.tier == 3 and inc.approval_status == "pending"
        res = asyncio.run(approve_incident(inc))
        assert res["approved"] is True
        assert inc.approval_status == "approved"
        assert res["execution_results"][0]["ok"] is True

    def test_approve_does_not_execute_while_kill_switch_engaged(self):
        engage_kill_switch()
        inc = _incident()
        asyncio.run(run_policy_and_execution(inc, _arbiter([_opt(reversible=False)])))
        res = asyncio.run(approve_incident(inc))
        # The action is held, not executed; the incident is flagged blocked.
        assert res["execution_results"] == []
        assert inc.blocked_by_kill_switch is True


# --------------------------------------------------------------------------- #
# Story 1.13: mock override
# --------------------------------------------------------------------------- #
class TestMockOverride:
    def teardown_method(self):
        reset_mock_agents()

    def test_default_no_mock_forced(self):
        assert is_mock_forced("berth") is False

    def test_set_mock_agents(self):
        set_mock_agents({"berth": True})
        assert is_mock_forced("berth") is True
        assert is_mock_forced("crane") is False

    def test_canned_arbiter_structure(self):
        canned = canned_arbiter()
        assert canned["specialist_disagreement"] is False
        assert len(canned["options"]) == 3
        assert all("option_id" not in opt for opt in canned["options"])


# --------------------------------------------------------------------------- #
# Story 1.11: mock execution unit
# --------------------------------------------------------------------------- #
class TestMockExecution:
    def test_execute_action_records_each_call(self):
        registry = build_registry()
        action = {"calls": [{"service": "tos", "payload": {}}, {"service": "crane_scheduler", "payload": {}}]}
        results = asyncio.run(execute_action(action, registry))
        assert len(results) == 2
        assert all(r["ok"] is True for r in results)
        assert {r["service"] for r in results} == {"tos", "crane_scheduler"}

    def test_execute_action_unknown_service_fails(self):
        registry = build_registry()
        results = asyncio.run(execute_action({"calls": [{"service": "nope", "payload": {}}]}, registry))
        assert results[0]["ok"] is False
        assert "unknown" in results[0]["error"]
