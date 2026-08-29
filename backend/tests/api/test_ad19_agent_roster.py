"""AD-19: the specialist bundle is exposed read-only for the Harbor Signal agent roster.

Covers the spec's I/O & Edge-Case Matrix:
- `Incident.agents` defaults to `[]` and every existing construction stays valid;
- `demo-tier3-alts` carries a 3-element roster in berth -> crane -> yard order;
- that incident's trace carries exactly 3 `AGENT_CALL` entries, the crane one
  keeping the `{stage, error, retried, fallback_used}` failure shape;
- `agents` is serialized on both `GET /incidents` and `GET /incidents/{id}`;
- every demo incident's roster (when present) is a full berth/crane/yard triple
  paired 1:1 with `AGENT_CALL` trace entries, no partial entries.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from api import state
from api.app import app
from api.demo_seed import demo_incidents
from models.incident import Incident
from policy.killswitch import reset_kill_switch_for_tests

_ROSTER_KEYS = {"agent", "summary", "actions", "constraints", "rationale"}
_STAGE_BEFORE_AGENTS = {"CONFIDENCE", "POLICY_DECISION"}


def _demo(incident_id: str) -> Incident:
    matches = [i for i in demo_incidents() if i.incident_id == incident_id]
    assert len(matches) == 1, f"expected exactly one {incident_id} demo incident"
    return matches[0]


def _mk_incident(iid: str, **kw) -> Incident:
    return Incident(
        incident_id=iid,
        created_at="2026-08-28T08:00:00+00:00",
        last_signal_at="2026-08-28T08:05:00+00:00",
        **kw,
    )


# --- Field default -------------------------------------------------------

def test_agents_defaults_to_empty_list_when_omitted() -> None:
    assert _mk_incident("x").agents == []


def test_agents_accepts_a_list_of_dicts() -> None:
    entry = {
        "agent": "berth",
        "summary": "s",
        "actions": ["a"],
        "constraints": [],
        "rationale": "r",
    }
    inc = _mk_incident("x", agents=[entry])
    assert inc.agents == [entry]
    assert inc.model_dump()["agents"] == [entry]


def test_two_incidents_do_not_share_the_agents_list() -> None:
    a = _mk_incident("a")
    b = _mk_incident("b")
    a.agents.append({"agent": "berth"})
    assert b.agents == []


# --- Demo roster -------------------------------------------------------

def test_demo_tier3_alts_carries_a_three_agent_roster_in_order() -> None:
    incident = _demo("demo-tier3-alts")

    assert [a["agent"] for a in incident.agents] == ["berth", "crane", "yard"]
    for entry in incident.agents:
        assert set(entry) == _ROSTER_KEYS  # exactly these keys, no strays
        assert isinstance(entry["summary"], str) and entry["summary"].strip()
        assert isinstance(entry["rationale"], str) and entry["rationale"].strip()
        assert isinstance(entry["actions"], list)
        assert isinstance(entry["constraints"], list)


# --- Demo stage rail -------------------------------------------------------

def test_demo_tier3_alts_has_exactly_three_agent_call_trace_entries() -> None:
    incident = _demo("demo-tier3-alts")

    agent_calls = [e for e in incident.trace if e.stage == "AGENT_CALL"]
    assert len(agent_calls) == 3
    assert [e.detail.get("agent") for e in agent_calls] == ["berth", "crane", "yard"]


def test_demo_tier3_alts_crane_agent_call_keeps_the_failure_shape() -> None:
    incident = _demo("demo-tier3-alts")

    def _agent_call(name: str):
        return next(
            (e for e in incident.trace if e.stage == "AGENT_CALL" and e.detail.get("agent") == name),
            None,
        )

    crane = _agent_call("crane")
    assert crane is not None
    assert crane.error is not None
    assert crane.error["stage"] == "AGENT_CALL"
    assert crane.error["retried"] is True
    assert crane.error["fallback_used"] is True
    assert crane.detail.get("mock_forced") is False

    for other in ("berth", "yard"):
        entry = _agent_call(other)
        assert entry is not None
        assert entry.error is None
        assert entry.detail.get("mock_forced") is False


def test_demo_tier3_alts_agent_calls_sit_between_correlate_and_policy() -> None:
    incident = _demo("demo-tier3-alts")
    stages = [e.stage for e in incident.trace]

    last_correlate = max(i for i, s in enumerate(stages) if s == "CORRELATE")
    first_after = min(i for i, s in enumerate(stages) if s in _STAGE_BEFORE_AGENTS)
    agent_positions = [i for i, s in enumerate(stages) if s == "AGENT_CALL"]

    assert agent_positions
    assert all(last_correlate < p < first_after for p in agent_positions)


# --- Every demo incident: roster <-> stage-rail coherence ----------------

def test_demo_rosters_pair_one_to_one_with_agent_call_trace_entries() -> None:
    for incident in demo_incidents():
        assert isinstance(incident.agents, list)
        if not incident.agents:
            continue
        roster_agents = [a["agent"] for a in incident.agents]
        assert roster_agents == ["berth", "crane", "yard"]
        for entry in incident.agents:
            assert set(entry) == _ROSTER_KEYS
        trace_agents = [
            e.detail.get("agent") for e in incident.trace if e.stage == "AGENT_CALL"
        ]
        assert trace_agents == roster_agents


# --- Serialization -------------------------------------------------------

@pytest.fixture()
def seeded_client(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    monkeypatch.setenv("PORTWATCH_SEED", "0")  # seed manually below for determinism
    state.reset_state()
    reset_kill_switch_for_tests()
    for inc in demo_incidents():
        state.add_incident(inc)
    with TestClient(app) as c:
        yield c
    state.reset_state()
    reset_kill_switch_for_tests()


def test_list_endpoint_includes_agents_key(seeded_client: TestClient) -> None:
    body = seeded_client.get("/incidents").json()
    assert body
    for item in body:
        assert "agents" in item
        assert isinstance(item["agents"], list)

    tier3 = next(i for i in body if i["incident_id"] == "demo-tier3-alts")
    assert [a["agent"] for a in tier3["agents"]] == ["berth", "crane", "yard"]


def test_detail_endpoint_returns_the_roster_array(seeded_client: TestClient) -> None:
    body = seeded_client.get("/incidents/demo-tier3-alts").json()
    assert "agents" in body
    assert [a["agent"] for a in body["agents"]] == ["berth", "crane", "yard"]
    for entry in body["agents"]:
        assert {"summary", "actions", "constraints", "rationale"} <= set(entry)
    agent_calls = [e for e in body["trace"] if e["stage"] == "AGENT_CALL"]
    assert len(agent_calls) == 3
