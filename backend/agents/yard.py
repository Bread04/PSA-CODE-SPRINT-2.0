"""Yard specialist - pure data (Story 1.3 / AD-3).

Scopes an LLM call to yard-block occupancy, congestion, and re-grade / move
planning across the two terminal blocks (Tuas C7, Pasir Panjang P2 - AD-12).
Exports only `NAME`, `SYSTEM_PROMPT`, `TOOL_MANIFEST`; the call shape lives in
`agents.base`. `TOOL_MANIFEST` tool names are disjoint from berth's and
crane's.
"""

from __future__ import annotations

from agents.base import render_system_prompt

NAME = "yard"

SYSTEM_PROMPT = render_system_prompt(
    name=NAME,
    mandate=(
        "You are the Yard specialist in a container terminal's autonomous "
        "incident-response system. Analyse the disruption only through the lens of "
        "yard-block occupancy and congestion, container re-grade / re-marshalling "
        "moves, AGV/prime-mover flow, and gate-to-yard pressure, across the Tuas C7 "
        "and Pasir Panjang P2 blocks. Do not recommend vessel reberthing or crane "
        "reallocation - separate specialists own those domains; state the yard-side "
        "constraints they must respect."
    ),
)

TOOL_MANIFEST: list[dict] = [
    {
        "name": "get_yard_block_occupancy",
        "description": "Return current slot occupancy and reserved capacity for a yard block.",
        "input_schema": {
            "type": "object",
            "properties": {
                "yard_block": {
                    "type": "string",
                    "description": "Yard block identifier, e.g. 'Tuas C7' or 'Pasir Panjang P2'.",
                }
            },
            "required": ["yard_block"],
        },
    },
    {
        "name": "get_yard_congestion",
        "description": "Return the congestion level and trend for a yard block or the berth it serves.",
        "input_schema": {
            "type": "object",
            "properties": {
                "yard_block": {
                    "type": "string",
                    "description": "Yard block identifier, e.g. 'Tuas C7'.",
                }
            },
            "required": ["yard_block"],
        },
    },
    {
        "name": "propose_yard_regrade",
        "description": "Draft a re-marshalling / re-grade move set to relieve a congested block.",
        "input_schema": {
            "type": "object",
            "properties": {
                "from_yard_block": {"type": "string", "description": "Congested source block."},
                "to_yard_block": {"type": "string", "description": "Target block with spare capacity."},
                "container_count": {
                    "type": "integer",
                    "description": "Approximate number of containers to move.",
                },
            },
            "required": ["from_yard_block", "to_yard_block", "container_count"],
        },
    },
]
