"""Spec 3.4: deterministic proof that the mocked MPA clearance-check service
(`mpa_clearance`) plugs into the existing mock roster, flows through
`execute_action`, and integrates with the real `run_policy_and_execution`
pipeline with no new stage, tier, endpoint, or `run.py` change.

Source of truth:
_bmad-output/implementation-artifacts/spec-3-4-mocked-mpa-clearance-check.md.

Design
------
* `mpa_clearance` is a plain member of `SERVICE_NAMES` / `build_registry()`.
* Its success `result` models the digitalPORT@SG shape
  `{service, clearance_status, conditions, request_ref}`, derived purely from
  the call payload (no randomness, no wall-clock, no I/O).
* THROUGH_PIPELINE never edits `run.py`: the test monkeypatches
  `orchestrator.run._option_to_action` to append an `mpa_clearance` call to the
  real action it builds, then drives the real `run_policy_and_execution`.
* Globals are reset before every run (`reset_kill_switch_for_tests`,
  `reset_mock_agents`); everything is deterministic and driven via `asyncio.run`.
"""

from __future__ import annotations

import asyncio

import orchestrator.run as run_mod

from models.incident import Incident
from models.recovery import PredictedImpact, RecoveryOption

from agents.arbiter import ArbiterResult
from agents.mock_override import reset_mock_agents

from policy.killswitch import reset_kill_switch_for_tests

from orchestrator.run import run_policy_and_execution
from orchestrator.trace import STAGES, now_utc

from mock_services.services import (
    MPA_CLEARANCE,
    MpaClearanceService,
    SERVICE_NAMES,
    _mpa_conditions_for,
    build_registry,
    execute_action,
)

_ALLOWED_STATUSES = {"granted", "conditional", "refused"}

# The pinned, deterministic condition strings (spec-3-4).
_CONDITIONAL_CONDITIONS = ["submit_imdg_declaration", "escort_tug_required"]
_REFUSED_CONDITIONS = ["clearance_denied_resubmit_corrected_manifest"]


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
def _reset_globals() -> None:
    reset_kill_switch_for_tests()
    reset_mock_agents()


def _opt(
    *,
    reversible: bool = True,
    risk: str = "low",
    cost: str = "low",
    delay: int = 30,
    dg: bool = False,
    description: str = "recover in place",
) -> RecoveryOption:
    return RecoveryOption(
        option_id="opt-1",
        description=description,
        predicted_impact=PredictedImpact(delay_min=delay, cost=cost, yard_impact="minor", risk=risk),
        reversible=reversible,
        dg_involved=dg,
    )


def _arbiter(options: list[RecoveryOption]) -> ArbiterResult:
    return ArbiterResult(
        options=options,
        specialist_disagreement=False,
        disagreement_summary="",
    )


def _incident() -> Incident:
    stamp = now_utc()
    return Incident(incident_id="inc-mpa-1", created_at=stamp, last_signal_at=stamp)


# --------------------------------------------------------------------------- #
# I/O matrix row: HAPPY_PATH
# --------------------------------------------------------------------------- #
def test_happy_path_shape_and_ref_echo():
    svc = build_registry()["mpa_clearance"]
    out = asyncio.run(svc.execute({"clearance_ref": "REQ-1"}))

    assert set(out) == {"ok", "result", "error"}
    assert out["ok"] is True
    assert out["error"] is None

    result = out["result"]
    assert result["service"] == "mpa_clearance"
    assert result["clearance_status"] in _ALLOWED_STATUSES
    assert isinstance(result["conditions"], list)
    assert all(isinstance(c, str) for c in result["conditions"])
    # request_ref echoes the caller's ref.
    assert result["request_ref"] == "REQ-1"


def test_happy_path_is_deterministic_across_repeats():
    svc = build_registry()["mpa_clearance"]
    payload = {"clearance_ref": "REQ-DET", "vessel": "VOY-9"}
    first = asyncio.run(svc.execute(payload))
    for _ in range(5):
        assert asyncio.run(svc.execute(payload)) == first


def test_plain_granted_has_no_conditions():
    svc = build_registry()["mpa_clearance"]
    out = asyncio.run(svc.execute({"request_ref": "REQ-CLEAN"}))
    assert out["result"]["clearance_status"] == "granted"
    assert out["result"]["conditions"] == []
    assert out["result"]["request_ref"] == "REQ-CLEAN"


def test_request_ref_falls_back_to_placeholder():
    svc = build_registry()["mpa_clearance"]
    out = asyncio.run(svc.execute({}))
    assert out["result"]["request_ref"] == "MPA-REQ"


def test_present_but_empty_clearance_ref_is_echoed_verbatim():
    svc = build_registry()["mpa_clearance"]
    out = asyncio.run(svc.execute({"clearance_ref": ""}))
    # Presence, not truthiness, decides - an empty string is still the ref.
    assert out["result"]["request_ref"] == ""


def test_non_string_clearance_ref_is_stringified():
    svc = build_registry()["mpa_clearance"]
    out = asyncio.run(svc.execute({"clearance_ref": 12345}))
    assert out["result"]["request_ref"] == "12345"


def test_non_dict_action_does_not_raise():
    svc = build_registry()["mpa_clearance"]
    for bad in (None, "x", 42, ["calls"]):
        out = asyncio.run(svc.execute(bad))
        assert out["ok"] is True
        assert out["error"] is None
        assert out["result"]["clearance_status"] == "granted"
        assert out["result"]["conditions"] == []
        assert out["result"]["request_ref"] == "MPA-REQ"


def test_registered_in_roster_and_registry():
    assert MPA_CLEARANCE == "mpa_clearance"
    assert MPA_CLEARANCE in SERVICE_NAMES
    registry = build_registry()
    assert MPA_CLEARANCE in registry
    assert isinstance(registry[MPA_CLEARANCE], MpaClearanceService)


# --------------------------------------------------------------------------- #
# I/O matrix row: CONDITIONAL
# --------------------------------------------------------------------------- #
def test_hazmat_flag_yields_conditional_with_pinned_conditions():
    svc = build_registry()["mpa_clearance"]
    out = asyncio.run(svc.execute({"clearance_ref": "REQ-HAZ", "hazmat": True}))
    result = out["result"]
    assert result["clearance_status"] == "conditional"
    assert result["conditions"] == _CONDITIONAL_CONDITIONS
    assert result["request_ref"] == "REQ-HAZ"


def test_every_conditional_trigger_key_yields_conditional():
    svc = build_registry()["mpa_clearance"]
    for key in ("dg", "imdg", "dangerous_goods", "dg_involved"):
        out = asyncio.run(svc.execute({key: True}))
        assert out["result"]["clearance_status"] == "conditional", key
        assert out["result"]["conditions"] == _CONDITIONAL_CONDITIONS, key


def test_falsy_flag_values_do_not_trigger():
    svc = build_registry()["mpa_clearance"]
    for falsy in (False, 0, ""):
        out = asyncio.run(svc.execute({"hazmat": falsy}))
        assert out["result"]["clearance_status"] == "granted"
        assert out["result"]["conditions"] == []


def test_helper_conditions_are_pinned_per_status():
    assert _mpa_conditions_for({"hazmat": True}) == _CONDITIONAL_CONDITIONS
    assert _mpa_conditions_for({"deny": True}) == _REFUSED_CONDITIONS
    assert _mpa_conditions_for({}) == []


def test_conditions_list_is_fresh_per_call():
    svc = build_registry()["mpa_clearance"]
    a = asyncio.run(svc.execute({"hazmat": True}))
    b = asyncio.run(svc.execute({"hazmat": True}))
    a["result"]["conditions"].append("MUTATED")
    assert b["result"]["conditions"] == _CONDITIONAL_CONDITIONS


# --------------------------------------------------------------------------- #
# I/O matrix row: explicit deny -> refused
# --------------------------------------------------------------------------- #
def test_explicit_deny_yields_refused_with_pinned_conditions():
    svc = build_registry()["mpa_clearance"]
    out = asyncio.run(svc.execute({"clearance_ref": "REQ-NO", "deny": True}))
    result = out["result"]
    assert result["clearance_status"] == "refused"
    assert result["conditions"] == _REFUSED_CONDITIONS


def test_falsy_deny_does_not_refuse():
    svc = build_registry()["mpa_clearance"]
    for falsy in (False, "", 0):
        out = asyncio.run(svc.execute({"deny": falsy}))
        assert out["result"]["clearance_status"] == "granted"
        assert out["result"]["conditions"] == []


def test_deny_takes_precedence_over_hazmat():
    svc = build_registry()["mpa_clearance"]
    out = asyncio.run(svc.execute({"deny": True, "hazmat": True}))
    assert out["result"]["clearance_status"] == "refused"


# --------------------------------------------------------------------------- #
# I/O matrix row: FAIL_MODE
# --------------------------------------------------------------------------- #
def test_injected_failure_surfaces_not_swallowed():
    svc = MpaClearanceService("mpa_clearance", fail=True)
    out = asyncio.run(svc.execute({"clearance_ref": "REQ-1", "hazmat": True}))
    assert out["ok"] is False
    assert out["result"] is None
    assert out["error"].startswith("mpa_clearance:")


def test_failure_via_build_registry_failing_set():
    registry = build_registry(failing={"mpa_clearance"})
    out = asyncio.run(registry["mpa_clearance"].execute({}))
    assert out["ok"] is False
    assert out["result"] is None


# --------------------------------------------------------------------------- #
# I/O matrix row: IN_ACTION
# --------------------------------------------------------------------------- #
def test_execute_action_records_mpa_row_individually():
    registry = build_registry()
    action = {
        "calls": [
            {"service": "tos", "payload": {"option_id": "opt-1"}},
            {"service": "mpa_clearance", "payload": {"clearance_ref": "REQ-ACT", "hazmat": True}},
        ]
    }
    rows = asyncio.run(execute_action(action, registry))

    assert len(rows) == 2
    assert [r["service"] for r in rows] == ["tos", "mpa_clearance"]
    for row in rows:
        assert set(row) >= {"service", "ok", "result", "error"}
        assert row["ok"] is True

    mpa_row = rows[1]
    assert mpa_row["result"]["service"] == "mpa_clearance"
    assert mpa_row["result"]["clearance_status"] == "conditional"
    assert mpa_row["result"]["conditions"]
    assert mpa_row["result"]["request_ref"] == "REQ-ACT"
    # The MPA outcome is its own row, never rolled into the tos row.
    assert rows[0]["result"]["service"] == "tos"


def test_execute_action_unknown_service_still_a_failure():
    registry = build_registry()
    action = {"calls": [{"service": "mpa_clearance", "payload": {}}, {"service": "nope", "payload": {}}]}
    rows = asyncio.run(execute_action(action, registry))
    assert rows[0]["ok"] is True
    assert rows[1]["ok"] is False
    assert "unknown" in rows[1]["error"]


def test_execute_action_two_mpa_calls_stay_separate_rows():
    registry = build_registry()
    action = {
        "calls": [
            {"service": "mpa_clearance", "payload": {"clearance_ref": "A"}},
            {"service": "mpa_clearance", "payload": {"clearance_ref": "B"}},
        ]
    }
    rows = asyncio.run(execute_action(action, registry))
    assert len(rows) == 2
    assert rows[0]["result"]["request_ref"] == "A"
    assert rows[1]["result"]["request_ref"] == "B"
    assert rows[0]["result"] is not rows[1]["result"]


# --------------------------------------------------------------------------- #
# I/O matrix row: THROUGH_PIPELINE
# --------------------------------------------------------------------------- #
def _drive(incident: Incident, arbiter: ArbiterResult, registry) -> dict:
    return asyncio.run(
        run_policy_and_execution(
            incident,
            arbiter,
            execute_registry=registry,
            staleness_seconds=0,
        )
    )


def _patch_option_to_action_with_mpa(monkeypatch, payload: dict) -> None:
    """Append an `mpa_clearance` call to the real action `run.py` builds.

    This is a test-only monkeypatch of `orchestrator.run._option_to_action`;
    `run.py` itself is byte-unchanged.
    """
    real = run_mod._option_to_action

    def _with_mpa(option):
        action = real(option)
        action["calls"].append({"service": "mpa_clearance", "payload": dict(payload)})
        return action

    monkeypatch.setattr(run_mod, "_option_to_action", _with_mpa)


def test_through_pipeline_reaches_execute_and_verify(monkeypatch):
    _reset_globals()

    # Baseline: same option, no MPA call -> record the tier.
    baseline_inc = _incident()
    baseline = _drive(baseline_inc, _arbiter([_opt()]), build_registry())
    baseline_tier = baseline["tier"]
    assert baseline_inc.tier == baseline_tier

    # Now with an mpa_clearance call appended to the action.
    _patch_option_to_action_with_mpa(monkeypatch, {"clearance_ref": "REQ-PIPE-1"})
    inc = _incident()
    res = _drive(inc, _arbiter([_opt()]), build_registry())

    stages = {e.stage for e in inc.trace}
    assert "EXECUTE" in stages
    assert "VERIFY" in stages
    assert stages <= set(STAGES), f"trace stage outside STAGES: {stages - set(STAGES)}"

    rows = res["execution_results"]
    assert rows is not None
    mpa_rows = [r for r in rows if r["service"] == "mpa_clearance"]
    assert len(mpa_rows) == 1
    assert mpa_rows[0]["ok"] is True
    assert mpa_rows[0]["result"]["clearance_status"] in _ALLOWED_STATUSES
    assert mpa_rows[0]["result"]["request_ref"] == "REQ-PIPE-1"

    # The MPA call did not change the tier and did not resolve differently.
    assert res["tier"] == baseline_tier
    assert inc.tier == baseline_tier
    assert inc.status == "resolved"


def test_through_pipeline_failing_mpa_leaves_incident_open(monkeypatch):
    _reset_globals()
    _patch_option_to_action_with_mpa(monkeypatch, {"clearance_ref": "REQ-PIPE-FAIL"})

    inc = _incident()
    res = _drive(inc, _arbiter([_opt()]), build_registry(failing={"mpa_clearance"}))

    stages = {e.stage for e in inc.trace}
    assert stages <= set(STAGES)
    assert "EXECUTE" in stages

    rows = res["execution_results"]
    assert rows is not None
    mpa_rows = [r for r in rows if r["service"] == "mpa_clearance"]
    assert len(mpa_rows) == 1
    assert mpa_rows[0]["ok"] is False
    assert isinstance(mpa_rows[0]["error"], str) and mpa_rows[0]["error"]

    # The sibling `tos` call still succeeded on its own row - the MPA failure
    # is not rolled up into it.
    tos_rows = [r for r in rows if r["service"] == "tos"]
    assert len(tos_rows) == 1
    assert tos_rows[0]["ok"] is True

    # Existing execution-failure behaviour: incident is not resolved.
    assert inc.status == "open"
