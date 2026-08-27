"""Process-global incident store for the HTTP API.

AD-1 (single process) + AD-9 (no persistence): one in-memory `IncidentRegistry`
for the life of the server. `reset_state()` exists for tests.
"""

from __future__ import annotations

from models.incident import Incident
from registry.incident_registry import IncidentRegistry

_registry = IncidentRegistry()


def get_registry() -> IncidentRegistry:
    """The one process-global registry."""
    return _registry


def list_incidents() -> list[Incident]:
    """Every incident the registry holds, newest correlated signal first."""
    incidents = list(_registry._incidents.values())  # noqa: SLF001 - same package boundary
    incidents.sort(key=lambda inc: inc.last_signal_at, reverse=True)
    return incidents


def get_incident(incident_id: str) -> Incident | None:
    """One incident by id, or None."""
    return _registry.get(incident_id)


def add_incident(incident: Incident) -> None:
    """Insert a fully-formed incident (used by the demo seeder)."""
    _registry._incidents[incident.incident_id] = incident  # noqa: SLF001
    for ref in incident.entity_refs:
        _registry._by_entity.setdefault(ref, []).append(incident.incident_id)  # noqa: SLF001


def reset_state() -> None:
    """Drop every incident (test helper)."""
    global _registry
    _registry = IncidentRegistry()
