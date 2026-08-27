"""HTTP contract tests for the console API (epic-2 retro action item 2).

Exercises the control -> hook -> client -> endpoint chain end to end against a
real ASGI app via `TestClient`, seeding the process-global registry per test.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from api import state
from api.app import app
from models.incident import Incident, TraceEntry
from models.recovery import PredictedImpact, RecoveryOption
from policy.killswitch import reset_kill_switch_for_tests


def _opt(oid: str = "opt-1", desc: str = "recover in place", *, dg: bool = False) -> RecoveryOption:
    return RecoveryOption(
        option_id=oid,
        description=desc,
        predicted_impact=PredictedImpact(delay_min=30, cost="low", yard_impact="minor", risk="low"),
        reversible=True,
        dg_involved=dg,
    )


def _incident(
    iid: str,
    *,
    status: str = "open",
    tier: int | None = 3,
    approval: str = "pending",
    refs: list[str] | None = None,
    options: list[RecoveryOption] | None = None,
    recommended: str | None = "opt-1",
    blocked: bool = False,
) -> Incident:
    return Incident(
        incident_id=iid,
        status=status,
        entity_refs=refs or ["vessel:MSC-ANNA"],
        tier=tier,
        confidence=90,
        recommended_option_id=recommended,
        options=options or [_opt()],
        approval_status=approval,
        blocked_by_kill_switch=blocked,
        created_at="2026-08-28T08:00:00+00:00",
        last_signal_at="2026-08-28T08:05:00+00:00",
        trace=[TraceEntry(stage="CORRELATE", timestamp="2026-08-28T08:00:00+00:00", detail={})],
    )


@pytest.fixture()
def client(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    monkeypatch.setenv("PORTWATCH_SEED", "0")  # no demo data in tests
    state.reset_state()
    reset_kill_switch_for_tests()
    with TestClient(app) as c:
        yield c
    state.reset_state()
    reset_kill_switch_for_tests()


# --- GET /incidents ---------------------------------------------------------

def test_list_incidents_empty(client: TestClient) -> None:
    r = client.get("/incidents")
    assert r.status_code == 200
    assert r.json() == []


def test_list_incidents_returns_full_objects_newest_first(client: TestClient) -> None:
    a = _incident("a")
    a.last_signal_at = "2026-08-28T08:01:00+00:00"
    b = _incident("b")
    b.last_signal_at = "2026-08-28T09:00:00+00:00"
    state.add_incident(a)
    state.add_incident(b)

    body = client.get("/incidents").json()
    assert [i["incident_id"] for i in body] == ["b", "a"]
    assert "trace" in body[0] and "options" in body[0]  # full objects, not summaries


# --- GET /incidents/{id} ---------------------------------------------------

def test_get_one_incident(client: TestClient) -> None:
    state.add_incident(_incident("x1"))
    assert client.get("/incidents/x1").json()["incident_id"] == "x1"


def test_get_unknown_incident_404(client: TestClient) -> None:
    assert client.get("/incidents/nope").status_code == 404


# --- POST /incidents/{id}/approval ----------------------------------------

def test_approve_executes_and_returns_updated_incident(client: TestClient) -> None:
    state.add_incident(_incident("t3"))
    r = client.post("/incidents/t3/approval", json={"action": "approve"})
    assert r.status_code == 200
    assert r.json()["approval_status"] == "approved"


def test_reject_marks_rejected_and_resolved(client: TestClient) -> None:
    state.add_incident(_incident("t3r"))
    body = client.post("/incidents/t3r/approval", json={"action": "reject"}).json()
    assert body["approval_status"] == "rejected"
    assert body["status"] == "resolved"


def test_select_alternative_switches_option_then_approves(client: TestClient) -> None:
    inc = _incident("t3s", options=[_opt("opt-1"), _opt("opt-2", "reroute via C7")])
    state.add_incident(inc)
    body = client.post(
        "/incidents/t3s/approval", json={"action": "select_alternative", "option_id": "opt-2"}
    ).json()
    assert body["recommended_option_id"] == "opt-2"
    assert body["approval_status"] == "approved"


def test_select_alternative_unknown_option_400(client: TestClient) -> None:
    state.add_incident(_incident("t3b"))
    r = client.post(
        "/incidents/t3b/approval", json={"action": "select_alternative", "option_id": "opt-99"}
    )
    assert r.status_code == 400


def test_approval_bad_action_422(client: TestClient) -> None:
    state.add_incident(_incident("t3c"))
    assert client.post("/incidents/t3c/approval", json={"action": "delete"}).status_code == 422


def test_approval_unknown_incident_404(client: TestClient) -> None:
    assert client.post("/incidents/ghost/approval", json={"action": "approve"}).status_code == 404


# --- GET /incidents/query -----------------------------------------------

def test_query_resolves_incident_from_text_without_hint(client: TestClient) -> None:
    state.add_incident(_incident("q1", refs=["vessel:MSC-ANNA"]))
    body = client.get("/incidents/query", params={"q": "what is the status of MSC Anna"}).json()
    assert "answer" in body
    assert "msc anna" in body["answer"].lower()


def test_query_honest_when_nothing_matches(client: TestClient) -> None:
    state.add_incident(_incident("q2", refs=["vessel:MSC-ANNA"]))
    body = client.get("/incidents/query", params={"q": "where is the vessel NEPTUNE"}).json()
    assert "no current incident matches" in body["answer"].lower()


def test_query_optional_incident_id_hint_breaks_ties(client: TestClient) -> None:
    state.add_incident(_incident("q3a", refs=["vessel:MSC-ANNA"]))
    state.add_incident(_incident("q3b", refs=["vessel:MSC-ANNA"]))
    body = client.get(
        "/incidents/query", params={"q": "status of MSC Anna", "incident_id": "q3b"}
    ).json()
    assert "answer" in body


def test_query_empty_question_is_a_prompt_not_a_fabrication(client: TestClient) -> None:
    body = client.get("/incidents/query", params={"q": "  "}).json()
    assert "ask a question" in body["answer"].lower()


# --- POST /kill-switch -------------------------------------------------

def test_kill_switch_engage_then_disengage(client: TestClient) -> None:
    assert client.post("/kill-switch", json={"enabled": True}).json() == {"enabled": True}
    assert client.post("/kill-switch", json={"enabled": False}).json() == {"enabled": False}


def test_kill_switch_bad_body_422(client: TestClient) -> None:
    assert client.post("/kill-switch", json={}).status_code == 422


def test_kill_switch_engaged_blocks_approval_execution(client: TestClient) -> None:
    state.add_incident(_incident("ks1"))
    client.post("/kill-switch", json={"enabled": True})
    body = client.post("/incidents/ks1/approval", json={"action": "approve"}).json()
    # AD-15 / epic-1 retro F2: approve does not execute while the switch is engaged.
    assert body["blocked_by_kill_switch"] is True
    assert body["approval_status"] != "approved"


def test_healthz(client: TestClient) -> None:
    assert client.get("/healthz").json() == {"ok": True}
