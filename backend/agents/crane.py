"""Crane specialist - pure data (Story 1.3 / AD-3).

Scopes an LLM call to quay-crane availability, allocation, and equipment
faults. Exports only `NAME`, `SYSTEM_PROMPT`, `TOOL_MANIFEST`; the call shape
lives in `agents.base`. `TOOL_MANIFEST` tool names are disjoint from berth's
and yard's.
"""

from __future__ import annotations

from agents.base import render_system_prompt

NAME = "crane"

SYSTEM_PROMPT = render_system_prompt(
    name=NAME,
    mandate=(
        "You are the Crane specialist in a container terminal's autonomous "
        "incident-response system. Analyse the disruption only through the lens of "
        "quay-crane availability, crane-to-berth allocation, crane throughput / "
        "move rates, and equipment faults or maintenance. Do not recommend vessel "
        "reberthing or yard re-planning - separate specialists own those domains; "
        "state the crane-side constraints they must respect."
    ),
)

TOOL_MANIFEST: list[dict] = [
    {
        "name": "get_crane_status",
        "description": "Return operational status, fault state, and current move rate for a crane.",
        "input_schema": {
            "type": "object",
            "properties": {
                "crane_ref": {
                    "type": "string",
                    "description": "Entity ref of the crane, e.g. 'crane:QC-12'.",
                }
            },
            "required": ["crane_ref"],
        },
    },
    {
        "name": "get_crane_allocation",
        "description": "Return which cranes are currently assigned to a berth and their planned shifts.",
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
        "name": "propose_crane_reallocation",
        "description": "Draft a change to the set of cranes serving a berth.",
        "input_schema": {
            "type": "object",
            "properties": {
                "berth_ref": {"type": "string", "description": "Berth whose crane set changes."},
                "add_crane_refs": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Crane entity refs to add.",
                },
                "remove_crane_refs": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Crane entity refs to remove.",
                },
            },
            "required": ["berth_ref"],
        },
    },
]
