"""In-memory incident correlation registry (Story 1.2 / FR2 / AD-5).

`IncidentRegistry.correlate()` is the single point that turns a stream of
normalized `Signal`s into `Incident`s: given a signal it either returns the
open incident the signal belongs to, or creates a new one. Correlation is a
pure in-memory decision - no I/O, network, or DB - and the registry is the
only writer of the `Incident` objects it owns (AD-4's single-writer,
actor-per-incident paradigm; a signal fans out to at most one incident).

Correlation rule
----------------
A signal matches an incident when they share an `entity_ref` string
(exact equality - refs are assumed canonical from Story 1.1's
`make_entity_ref()`, not re-normalized here) *and* the incident is still
`open` *and* the signal's time is within `CORRELATION_WINDOW` of the
incident's most recent correlated signal (`last_signal_at`, not
`created_at`). The window is symmetric -
`abs(signal_time - last_signal_at) <= 15 min` - so a slightly out-of-order
straggler still correlates, while a signal hours in the past (stale replay
/ backfill) does not glue onto a recently-active incident.
`last_signal_at` itself only ever moves forward. A genuine 15-min-plus gap
spawns a new incident.

Deterministic routing
---------------------
The signal's entity refs are tried in order. `entity_refs[0]` is the
"primary" ref - the entity the signal type was ingested against (Story
1.1's handlers always list it first). The first ref that yields any
in-window open incident wins; among multiple incidents on that same ref
the tie-break is **earliest `created_at`, then lowest `incident_id`**.
This is fully insertion-order-independent so a signal never fans out.
"""

from __future__ import annotations

import copy
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from models.incident import Incident, TraceEntry
from models.signal import Signal

CORRELATION_WINDOW = timedelta(minutes=15)

CORRELATE_STAGE = "CORRELATE"


@dataclass
class CorrelationResult:
    """Outcome of `IncidentRegistry.correlate()`: the routed incident and whether it was just created."""

    incident: Incident
    created: bool


def _parse_iso(timestamp: str) -> datetime:
    """Parse an ISO 8601 timestamp to an aware UTC datetime.

    Tolerates a trailing 'Z' and naive timestamps (assumed UTC) so minor
    format differences in demo data do not break correlation.
    """
    text = timestamp.strip()
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    parsed = datetime.fromisoformat(text)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


class IncidentRegistry:
    """Keeps every open/closed `Incident` in memory and correlates signals into them (AD-5)."""

    def __init__(self) -> None:
        # incident_id -> Incident (the registry owns these objects).
        self._incidents: dict[str, Incident] = {}
        # entity ref -> incident ids that carry it, in first-seen order.
        self._by_entity: dict[str, list[str]] = {}

    # -- public API --------------------------------------------------------

    def get(self, incident_id: str) -> Incident | None:
        """Return the incident with `incident_id`, or None if unknown."""
        return self._incidents.get(incident_id)

    def open_incidents(self) -> list[Incident]:
        """Every incident still `open`, in creation (insertion) order."""
        return [inc for inc in self._incidents.values() if inc.status == "open"]

    def correlate(self, signal: Signal) -> CorrelationResult:
        """Route `signal` into an existing open incident, or create a new one."""
        if not signal.entity_refs:
            raise ValueError("signal has no entity_refs; cannot correlate")

        signal_time = _parse_iso(signal.received_at)

        match = self._find_match(signal, signal_time)
        if match is None:
            incident = self._create_incident(signal)
            created = True
        else:
            incident = match
            self._merge_signal(incident, signal, signal_time)
            created = False

        incident.trace.append(
            TraceEntry(
                stage=CORRELATE_STAGE,
                # Deterministic: the trace step is stamped with the signal's
                # own time, not wall-clock, so replays / tests are stable.
                timestamp=signal.received_at,
                detail={
                    "signal_type": signal.signal_type,
                    "matched": not created,
                    "entity_refs": list(signal.entity_refs),
                    "incident_id": incident.incident_id,
                    # Story 1.3: carry the correlated signal's actual content
                    # (ETA value, alert body, congestion level, ...) forward on
                    # the incident so downstream specialist briefs can reason
                    # over real signal data, not just entity refs / metadata.
                    # Deep-copied so the trace detail never aliases the signal's
                    # own dict.
                    "payload": copy.deepcopy(signal.payload),
                },
            )
        )
        return CorrelationResult(incident=incident, created=created)

    # -- matching --------------------------------------------------------

    def _find_match(self, signal: Signal, signal_time: datetime) -> Incident | None:
        """Return the one incident `signal` correlates into, or None.

        Refs are tried primary-first (`entity_refs[0]` is the entity the
        signal type was ingested against). The first ref with any in-window
        open candidate decides the routing; the tie-break among candidates
        on that ref is earliest `created_at`, then lowest `incident_id` -
        deterministic regardless of dict / insertion order.
        """
        for ref in signal.entity_refs:
            candidates = [
                incident
                for incident_id in self._by_entity.get(ref, [])
                if (incident := self._incidents[incident_id]).status == "open"
                and abs(signal_time - _parse_iso(incident.last_signal_at)) <= CORRELATION_WINDOW
            ]
            if candidates:
                candidates.sort(key=lambda inc: (_parse_iso(inc.created_at), inc.incident_id))
                return candidates[0]
        return None

    # -- mutation ------------------------------------------------------

    def _create_incident(self, signal: Signal) -> Incident:
        refs = list(dict.fromkeys(signal.entity_refs))
        incident_id = str(uuid.uuid4())
        incident = Incident(
            incident_id=incident_id,
            status="open",
            entity_refs=refs,
            created_at=signal.received_at,
            last_signal_at=signal.received_at,
        )
        self._incidents[incident_id] = incident
        for ref in refs:
            self._by_entity.setdefault(ref, []).append(incident_id)
        return incident

    def _merge_signal(self, incident: Incident, signal: Signal, signal_time: datetime) -> None:
        """Union the signal's new refs into the incident and advance `last_signal_at`."""
        for ref in dict.fromkeys(signal.entity_refs):
            if ref not in incident.entity_refs:
                incident.entity_refs.append(ref)
                self._by_entity.setdefault(ref, []).append(incident.incident_id)

        # `last_signal_at` only ever moves forward: advance to the later of
        # the incident's current last-signal time and this signal's time.
        if signal_time > _parse_iso(incident.last_signal_at):
            incident.last_signal_at = signal.received_at
