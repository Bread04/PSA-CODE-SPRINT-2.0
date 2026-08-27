"""Story 1.13: Per-agent demo-safety mock override (AD-16).

Any specialist agent or the arbiter may be pinned to a canned response instead
of a live LLM call. The substitution is opt-in only - when `MOCK_AGENTS` is
unset or all-false, the pipeline is identical to before AD-16 existed. When an
agent is pinned, its Messages API call is short-circuited and a canned,
structurally-identical response is returned; the orchestrator records
`detail.mock_forced = true` on the `AGENT_CALL` trace and confidence applies the
same -15pt missing-data penalty as a fallback field.

Canned responses are structurally identical to real ones so every downstream
stage (correlation, policy, execution) consumes them exactly as it would live
output.
"""

from __future__ import annotations

from typing import Any

# Opt-in only: empty => live LLM path (AD-16). Set e.g. {"berth": True, "arbiter": True}.
MOCK_AGENTS: dict[str, bool] = {}


def set_mock_agents(config: dict[str, bool]) -> None:
    """Replace the active mock-agent config (AD-16)."""
    MOCK_AGENTS.clear()
    MOCK_AGENTS.update(config)


def reset_mock_agents() -> None:
    """Test helper: clear all mock-agent overrides back to the opt-in default."""
    MOCK_AGENTS.clear()


def is_mock_forced(agent: str) -> bool:
    """True when `agent` (berth/crane/yard/arbiter) is pinned to a canned response."""
    return bool(MOCK_AGENTS.get(agent, False))


# Canned, structurally-identical specialist recommendations (validated downstream
# as `SpecialistRecommendation`). The brief text is ignored - the response is fixed.
CANNED_SPECIALIST: dict[str, dict[str, Any]] = {
    "berth": {
        "agent": "berth",
        "summary": "[MOCK] berth assessment",
        "actions": ["[MOCK] hold berth window"],
        "constraints": [],
        "rationale": "[MOCK] canned berth rationale",
    },
    "crane": {
        "agent": "crane",
        "summary": "[MOCK] crane assessment",
        "actions": ["[MOCK] swap crane assignment"],
        "constraints": [],
        "rationale": "[MOCK] canned crane rationale",
    },
    "yard": {
        "agent": "yard",
        "summary": "[MOCK] yard assessment",
        "actions": ["[MOCK] re-plan yard block"],
        "constraints": [],
        "rationale": "[MOCK] canned yard rationale",
    },
}


def canned_specialist(agent: str) -> dict[str, Any]:
    """The canned JSON object for a pinned specialist agent (Story 1.13)."""
    return CANNED_SPECIALIST[agent]


# Canned arbiter result: three ranked options, no disagreement (validated as
# `ArbiterResult` downstream).
CANNED_ARBITER: dict[str, Any] = {
    "options": [
        {
            "description": "[MOCK] absorb the delay in place",
            "predicted_impact": {"delay_min": 30, "cost": "low", "yard_impact": "minor", "risk": "low"},
            "reversible": True,
            "dg_involved": False,
        },
        {
            "description": "[MOCK] re-plan to adjacent berth",
            "predicted_impact": {"delay_min": 20, "cost": "medium", "yard_impact": "some", "risk": "medium"},
            "reversible": True,
            "dg_involved": False,
        },
        {
            "description": "[MOCK] reroute to alternate terminal",
            "predicted_impact": {"delay_min": 10, "cost": "high", "yard_impact": "major", "risk": "high"},
            "reversible": False,
            "dg_involved": False,
        },
    ],
    "specialist_disagreement": False,
    "disagreement_summary": "",
}


def canned_arbiter() -> dict[str, Any]:
    """The canned JSON object for a pinned arbiter (Story 1.13)."""
    return CANNED_ARBITER
