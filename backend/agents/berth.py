"""Berth/Vessel specialist - pure data (Story 1.3 / AD-3).

Scopes an LLM call to vessel schedules, ETAs, and berth-window assignment.
Exports only `NAME`, `SYSTEM_PROMPT`, `TOOL_MANIFEST`; the call shape lives in
`agents.base`. `TOOL_MANIFEST` tool names are disjoint from crane's and
yard's so the API-call boundary can enforce that this agent never sees
another domain's tools.
"""

from __future__ import annotations

from agents.base import render_system_prompt

NAME = "berth"

SYSTEM_PROMPT = render_system_prompt(
    name=NAME,
    mandate=(
        "You are the Berth/Vessel specialist in a container terminal's autonomous "
        "incident-response system. Analyse the disruption only through the lens of "
        "vessel schedules, ETA and ATA changes, berthing windows, berth allocation, "
        "and pilotage/tug dependencies. Do not recommend crane allocations or yard "
        "re-planning - separate specialists own those domains; defer to them and, "
        "where relevant, state the berth-side constraints they must respect."
    ),
)

TOOL_MANIFEST: list[dict] = [
    {
        "name": "get_vessel_schedule",
        "description": "Look up the current schedule (ETA, ATA, planned berth window) for a vessel.",
        "input_schema": {
            "type": "object",
            "properties": {
                "vessel_ref": {
                    "type": "string",
                    "description": "Entity ref of the vessel, e.g. 'vessel:MSC-ANNA'.",
                }
            },
            "required": ["vessel_ref"],
        },
    },
    {
        "name": "get_berth_availability",
        "description": "Return occupancy and free windows for a berth over the next 24 hours.",
        "input_schema": {
            "type": "object",
            "properties": {
                "berth_ref": {
                    "type": "string",
                    "description": "Entity ref of the berth, e.g. 'berth:C7-3'.",
                }
            },
            "required": ["berth_ref"],
        },
    },
    {
        "name": "propose_berth_reassignment",
        "description": "Draft a move of a vessel to a different berth or berth window.",
        "input_schema": {
            "type": "object",
            "properties": {
                "vessel_ref": {"type": "string", "description": "Vessel to move."},
                "to_berth_ref": {"type": "string", "description": "Target berth entity ref."},
                "new_window_start": {
                    "type": "string",
                    "description": "ISO 8601 UTC start of the proposed berth window.",
                },
            },
            "required": ["vessel_ref", "to_berth_ref", "new_window_start"],
        },
    },
]
