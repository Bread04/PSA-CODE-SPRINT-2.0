"""HTTP API layer for the Portwatch console (epic-2 retro action item 2).

Exposes the read-only Incident surface plus the two write paths the console
uses — the approval action and the kill switch — over the contract in
ARCHITECTURE-SPINE.md (lines 225-231). No new domain logic lives here: routes
are thin adapters over `registry.IncidentRegistry`, `orchestrator.run`, and
`policy.killswitch`.
"""
