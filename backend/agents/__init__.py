"""Specialist agent package (Story 1.3 / AD-2 / AD-3).

Each of `berth`, `crane`, `yard` is a *pure-data* module exporting `NAME`,
`SYSTEM_PROMPT`, and `TOOL_MANIFEST`. `base` owns the one shared call shape
(`call_specialist`) and the output models; `dispatch` runs the three calls
concurrently. Nothing here executes tool calls or talks to mock services -
that is Story 1.11.
"""
