"""spec-demo-three-way-disruption-trigger — the live demo trigger.

Covers every I/O & Edge-Case Matrix row: TRIGGER_OK, TRIGGER_BUSY (409),
PRIMARY_RUN, DG_REPLAN, CONCURRENT_B (+ an `_assert_isolated`-style leakage
check), OPERATOR_APPROVE.

The driver logic is exercised directly — `create_primary_incident()` then
`await run_three_way_disruption_demo(primary, step_delay=0)` — and the 409 is
hit through a `TestClient` with the run guard pre-set. Global state is reset
around every test.
"""

from __future__ import annotations

import asyncio

import pytest
from fastapi.testclient import TestClient

from api import app as app_module
from api import demo_driver, state
from api.app import app
from api.approval import apply_approval
from agents.mock_override import reset_mock_agents
from policy.killswitch import reset_kill_switch_for_tests


@pytest.fixture(autouse=True)
def _reset_globals(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("PORTWATCH_SEED", "0")
    state.reset_state()
    reset_kill_switch_for_tests()
    reset_mock_agents()
    demo_driver.reset_demo_run_state()
    yield
    state.reset_state()
    reset_kill_switch_for_tests()
    reset_mock_agents()
    demo_driver.reset_demo_run_state()


async def _noop(*_a, **_k):
    """Stand-in for the real driver so a `TestClient` POST does not spawn a ~20s task."""
    return None


def _run_demo(primary):
    asyncio.run(demo_driver.run_three_way_disruption_demo(primary, step_delay=0))


def _stages(incident) -> list[str]:
    return [e.stage for e in incident.trace]


# --------------------------------------------------------------------------- #
# TRIGGER_OK
# --------------------------------------------------------------------------- #
def test_trigger_ok_resets_state_and_creates_primary_with_correlate(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(demo_driver, "run_three_way_disruption_demo", _noop)
    # a stale incident that must be gone after the trigger
    stale = demo_driver.create_primary_incident()
    assert state.get_incident(stale.incident_id) is not None

    with TestClient(app) as client:
        r = client.post("/demo/three-way-disruption")

    assert r.status_code == 200
    body = r.json()
    assert body["started"] is True
    primary_id = body["primary_incident_id"]
    assert isinstance(primary_id, str) and primary_id

    assert state.get_incident(stale.incident_id) is None, "prior incidents must be cleared"
    primary = state.get_incident(primary_id)
    assert primary is not None
    assert "CORRELATE" in _stages(primary)
    assert _stages(primary)[0] == "INGEST", "INGEST is stamped before CORRELATE"


# --------------------------------------------------------------------------- #
# TRIGGER_BUSY
# --------------------------------------------------------------------------- #
def test_trigger_busy_returns_409_and_resets_nothing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(demo_driver, "run_three_way_disruption_demo", _noop)
    stale = demo_driver.create_primary_incident()
    demo_driver.mark_demo_run_active(True)

    with TestClient(app) as client:
        r = client.post("/demo/three-way-disruption")

    assert r.status_code == 409
    assert r.json()["detail"] == "a demo run is already in progress"
    assert state.get_incident(stale.incident_id) is not None, "a busy trigger must not reset"


def test_trigger_404_when_disabled(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("PORTWATCH_DEMO_TRIGGER", "0")
    monkeypatch.setattr(demo_driver, "run_three_way_disruption_demo", _noop)
    stale = demo_driver.create_primary_incident()

    with TestClient(app) as client:
        r = client.post("/demo/three-way-disruption")

    assert r.status_code == 404
    assert r.json()["detail"] == "demo trigger disabled"
    assert state.get_incident(stale.incident_id) is not None, "a disabled trigger must not reset"


def test_endpoint_schedules_and_drives_the_pipeline(monkeypatch: pytest.MonkeyPatch) -> None:
    """The endpoint's real `asyncio.create_task(...)` is load-bearing: it schedules
    the driver, which runs A to a Tier-3 hold and B concurrently to VERIFY."""
    real = demo_driver.run_three_way_disruption_demo
    monkeypatch.setattr(
        demo_driver,
        "run_three_way_disruption_demo",
        lambda primary, **_: real(primary, step_delay=0),
    )

    async def _scenario() -> str:
        resp = await app_module.post_demo_trigger()
        assert resp.started is True
        assert app_module._demo_task is not None
        await app_module._demo_task
        return resp.primary_incident_id

    primary_id = asyncio.run(_scenario())

    primary = state.get_incident(primary_id)
    assert primary is not None
    assert primary.tier == 3
    assert primary.approval_status == "pending"

    others = [i for i in state.list_incidents() if i.incident_id != primary_id]
    assert len(others) == 1
    assert _stages(others[0])[-1] == "VERIFY"


# --------------------------------------------------------------------------- #
# PRIMARY_RUN
# --------------------------------------------------------------------------- #
def test_primary_run_holds_tier3_with_fallback_and_low_confidence() -> None:
    primary = demo_driver.create_primary_incident()
    _run_demo(primary)

    assert primary.tier == 3
    assert primary.approval_status == "pending"
    assert primary.status == "open"

    # agents = berth / crane / yard, in order
    assert [a["agent"] for a in primary.agents] == ["berth", "crane", "yard"]

    stages = _stages(primary)
    for expected in ("INGEST", "CORRELATE", "AGENT_CALL", "SYNTHESIZE", "CONFIDENCE",
                     "POLICY_START", "POLICY_DECISION", "DG_CHECK", "APPROVAL"):
        assert expected in stages, f"missing {expected} in {stages}"
    assert stages.count("AGENT_CALL") == 3

    crane_calls = [
        e for e in primary.trace
        if e.stage == "AGENT_CALL" and (e.detail or {}).get("agent") == "crane"
    ]
    assert len(crane_calls) == 1
    assert crane_calls[0].error is not None
    assert crane_calls[0].error["fallback_used"] is True
    assert crane_calls[0].detail == {"agent": "crane", "mock_forced": False}

    assert primary.confidence < 70


# --------------------------------------------------------------------------- #
# DG_REPLAN
# --------------------------------------------------------------------------- #
def test_dg_replan_lands_on_a_non_dg_tier3_recommendation() -> None:
    primary = demo_driver.create_primary_incident()
    _run_demo(primary)

    dg_violations = [
        e for e in primary.trace
        if e.stage == "DG_CHECK" and (e.detail or {}).get("violation") is True
    ]
    assert len(dg_violations) >= 2, "one DG_CHECK violation per re-plan attempt"
    assert all(e.error is not None for e in dg_violations)

    # Final recommended option is non-DG and is what the operator would approve.
    assert primary.recommended_option_id is not None
    recommended = next(
        o for o in primary.options if o.option_id == primary.recommended_option_id
    )
    assert recommended.dg_involved is False
    assert primary.options[0].dg_involved is False

    approvals = [e for e in primary.trace if e.stage == "APPROVAL"]
    assert approvals and approvals[-1].detail.get("dg_forced") is True


# --------------------------------------------------------------------------- #
# CONCURRENT_B  (+ _assert_isolated-style leakage check)
# --------------------------------------------------------------------------- #
def test_concurrent_incident_b_auto_resolves_and_stays_isolated() -> None:
    primary = demo_driver.create_primary_incident()
    _run_demo(primary)

    incidents = state.list_incidents()
    others = [i for i in incidents if i.incident_id != primary.incident_id]
    assert len(others) == 1, "the driver creates exactly one concurrent incident"
    b = others[0]

    assert b.incident_id != primary.incident_id
    assert b.tier in (1, 2)
    assert b.status == "resolved"
    assert _stages(b)[-2:] == ["EXECUTE", "VERIFY"]
    assert b.confidence == 100  # aligned specialists -> no penalties

    # No trace entry on either incident references the other's id (AD-4).
    ids = {primary.incident_id, b.incident_id}
    assert len(ids) == 2
    for inc in (primary, b):
        for entry in inc.trace:
            ref = (entry.detail or {}).get("incident_id")
            if ref is not None:
                assert ref == inc.incident_id, f"trace leakage on {inc.incident_id}: {ref}"


# --------------------------------------------------------------------------- #
# OPERATOR_APPROVE
# --------------------------------------------------------------------------- #
def test_operator_approve_executes_the_non_dg_option() -> None:
    primary = demo_driver.create_primary_incident()
    _run_demo(primary)
    assert primary.approval_status == "pending"

    stages_before = _stages(primary)
    asyncio.run(apply_approval(primary, "approve"))

    assert primary.approval_status == "approved"
    assert primary.status == "resolved"
    appended = _stages(primary)[len(stages_before):]
    assert "EXECUTE" in appended and "VERIFY" in appended
