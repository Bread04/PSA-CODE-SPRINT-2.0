"""Unit tests for Story 1.2: Incident Correlation via 15-Minute Window.

Covers all 5 rows of the spec's I/O & edge-case matrix:
  1. Correlate into an open in-window incident (union refs, advance window).
  2. No entity match -> fresh open incident.
  3. Entity match but only outside the 15-min window -> new incident.
  4. Ambiguous multi-incident match -> routed by primary ref (entity_refs[0]).
  5. Stale incident (>15 min gap) reactivated by a later signal -> new incident.

Plus: tie-break determinism under permuted registry insertion order,
`last_signal_at` advancement extending the window, symmetric-window
rejection of stale replays, `_parse_iso` tolerance branches, empty-refs
guard, ref de-dup, the resolved-incident guard, and that a CORRELATE trace
entry (stamped with the signal's own time) is appended on both paths.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import pytest

from models.incident import Incident
from registry.incident_registry import CORRELATION_WINDOW, IncidentRegistry
from models.signal import Signal

BASE = datetime(2026, 8, 27, 10, 0, 0, tzinfo=timezone.utc)


def at(**delta) -> str:
    """ISO 8601 UTC timestamp offset from BASE, e.g. at(minutes=5)."""
    return (BASE + timedelta(**delta)).isoformat()


def make_signal(entity_refs, received_at, signal_type="vessel_eta", payload=None) -> Signal:
    return Signal(
        entity_refs=list(entity_refs),
        signal_type=signal_type,
        payload=payload or {},
        received_at=received_at,
    )


# ---------------------------------------------------------------------------
# Row 1: correlate into an open, in-window incident.
# ---------------------------------------------------------------------------


class TestCorrelateIntoOpenIncident:
    def test_second_signal_on_shared_ref_within_window_joins_same_incident(self):
        reg = IncidentRegistry()

        first = reg.correlate(make_signal(["vessel:V1"], at(minutes=0)))
        second = reg.correlate(make_signal(["vessel:V1", "berth:B1"], at(minutes=10)))

        assert first.created is True
        assert second.created is False
        assert second.incident.incident_id == first.incident.incident_id
        # New refs are unioned in.
        assert second.incident.entity_refs == ["vessel:V1", "berth:B1"]
        # Window advanced to the later signal time.
        assert second.incident.last_signal_at == at(minutes=10)
        # Only one incident exists overall.
        assert len(reg.open_incidents()) == 1

    def test_out_of_order_straggler_still_correlates_and_does_not_rewind_window(self):
        reg = IncidentRegistry()

        reg.correlate(make_signal(["vessel:V1"], at(minutes=10)))
        straggler = reg.correlate(make_signal(["vessel:V1"], at(minutes=5)))

        assert straggler.created is False
        # last_signal_at only ever moves forward.
        assert straggler.incident.last_signal_at == at(minutes=10)


# ---------------------------------------------------------------------------
# Row 2: no entity match -> new incident.
# ---------------------------------------------------------------------------


class TestNoMatchCreatesNewIncident:
    def test_disjoint_entity_refs_spawn_separate_incidents(self):
        reg = IncidentRegistry()

        a = reg.correlate(make_signal(["vessel:V1"], at(minutes=0)))
        b = reg.correlate(make_signal(["vessel:V2"], at(minutes=1)))

        assert a.created is True and b.created is True
        assert a.incident.incident_id != b.incident.incident_id
        assert len(reg.open_incidents()) == 2

    def test_new_incident_fields_match_signal(self):
        reg = IncidentRegistry()

        result = reg.correlate(make_signal(["berth:B1"], at(minutes=0), signal_type="crane_alert"))
        inc = result.incident

        assert inc.status == "open"
        assert inc.entity_refs == ["berth:B1"]
        assert inc.created_at == at(minutes=0)
        assert inc.last_signal_at == at(minutes=0)
        assert inc.confidence == 100
        assert inc.tier is None
        # incident_id is a UUID4 string.
        assert str(uuid.UUID(inc.incident_id, version=4)) == inc.incident_id
        # Registry exposes it via the public accessor.
        assert reg.get(inc.incident_id) is inc


# ---------------------------------------------------------------------------
# Row 3: match only outside the window -> new incident, stale one untouched.
# ---------------------------------------------------------------------------


class TestMatchOnlyOutsideWindow:
    def test_signal_just_past_window_spawns_new_incident(self):
        reg = IncidentRegistry()

        first = reg.correlate(make_signal(["vessel:V1"], at(minutes=0)))
        # 15 min + 1 s -> strictly outside CORRELATION_WINDOW.
        second = reg.correlate(make_signal(["vessel:V1"], at(minutes=15, seconds=1)))

        assert second.created is True
        assert second.incident.incident_id != first.incident.incident_id
        assert len(reg.open_incidents()) == 2
        # Stale incident is left unmodified.
        assert first.incident.entity_refs == ["vessel:V1"]
        assert first.incident.last_signal_at == at(minutes=0)
        assert len(first.incident.trace) == 1

    def test_signal_exactly_on_window_boundary_still_correlates(self):
        reg = IncidentRegistry()

        first = reg.correlate(make_signal(["vessel:V1"], at(minutes=0)))
        boundary = reg.correlate(make_signal(["vessel:V1"], at(seconds=CORRELATION_WINDOW.total_seconds())))

        assert boundary.created is False
        assert boundary.incident.incident_id == first.incident.incident_id


# ---------------------------------------------------------------------------
# Symmetric window: a stale replay far in the past does not glue onto a
# recently-active incident (P3).
# ---------------------------------------------------------------------------


class TestSymmetricWindow:
    def test_signal_two_hours_before_last_signal_does_not_correlate(self):
        reg = IncidentRegistry()

        recent = reg.correlate(make_signal(["vessel:V1"], at(minutes=0)))
        stale_replay = reg.correlate(make_signal(["vessel:V1"], at(hours=-2)))

        assert stale_replay.created is True
        assert stale_replay.incident.incident_id != recent.incident.incident_id
        # The recent incident is untouched.
        assert recent.incident.last_signal_at == at(minutes=0)
        assert len(recent.incident.trace) == 1


# ---------------------------------------------------------------------------
# Row 4: ambiguous multi-incident match -> routed by primary ref.
# ---------------------------------------------------------------------------


class TestAmbiguousMultiIncidentMatch:
    def test_routes_to_incident_matching_primary_ref(self):
        reg = IncidentRegistry()

        inc_a = reg.correlate(make_signal(["vessel:V1"], at(minutes=0))).incident
        inc_b = reg.correlate(make_signal(["berth:B1"], at(minutes=0), signal_type="crane_alert")).incident

        # vessel_eta ingested against vessel:V1 (primary), also carries berth:B1.
        result = reg.correlate(make_signal(["vessel:V1", "berth:B1"], at(minutes=5)))

        assert result.created is False
        assert result.incident.incident_id == inc_a.incident_id
        # Incident B is untouched.
        assert inc_b.entity_refs == ["berth:B1"]
        assert inc_b.last_signal_at == at(minutes=0)
        assert len(inc_b.trace) == 1
        # A absorbed the shared ref.
        assert result.incident.entity_refs == ["vessel:V1", "berth:B1"]

    def test_falls_through_to_secondary_ref_when_primary_has_no_candidate(self):
        reg = IncidentRegistry()

        inc_b = reg.correlate(make_signal(["berth:B1"], at(minutes=0), signal_type="crane_alert")).incident
        # Primary ref vessel:V9 matches nothing; secondary berth:B1 matches B.
        result = reg.correlate(make_signal(["vessel:V9", "berth:B1"], at(minutes=5)))

        assert result.created is False
        assert result.incident.incident_id == inc_b.incident_id


# ---------------------------------------------------------------------------
# Row 5: stale incident reactivated by a later signal -> new incident.
# ---------------------------------------------------------------------------


class TestStaleIncidentReactivation:
    def test_16_minute_gap_on_same_entity_spawns_new_incident(self):
        reg = IncidentRegistry()

        first = reg.correlate(make_signal(["crane:C1"], at(minutes=0), signal_type="crane_alert"))
        later = reg.correlate(make_signal(["crane:C1"], at(minutes=16), signal_type="crane_alert"))

        assert later.created is True
        assert later.incident.incident_id != first.incident.incident_id
        assert first.incident.last_signal_at == at(minutes=0)

    def test_two_signals_same_entity_20_minutes_apart_yield_two_incidents(self):
        # Acceptance criterion: 20 min apart -> two distinct ids, created both times.
        reg = IncidentRegistry()

        a = reg.correlate(make_signal(["vessel:V1"], at(minutes=0)))
        b = reg.correlate(make_signal(["vessel:V1"], at(minutes=20)))

        assert a.created is True and b.created is True
        assert a.incident.incident_id != b.incident.incident_id


# ---------------------------------------------------------------------------
# last_signal_at advancement extends the rolling window.
# ---------------------------------------------------------------------------


class TestRollingWindowAdvancement:
    def test_chained_signals_each_within_15_min_stay_one_incident_across_30_min(self):
        reg = IncidentRegistry()

        r0 = reg.correlate(make_signal(["vessel:V1"], at(minutes=0)))
        r1 = reg.correlate(make_signal(["vessel:V1"], at(minutes=12)))
        r2 = reg.correlate(make_signal(["vessel:V1"], at(minutes=24)))

        assert r1.created is False and r2.created is False
        assert r2.incident.incident_id == r0.incident.incident_id
        assert r2.incident.last_signal_at == at(minutes=24)
        assert len(reg.open_incidents()) == 1


# ---------------------------------------------------------------------------
# Tie-break determinism under permuted registry insertion order.
# ---------------------------------------------------------------------------


class TestTieBreakDeterminism:
    def _register(self, reg: IncidentRegistry, incident: Incident) -> None:
        """Insert a pre-built incident directly (bypassing correlate) for tie-break setup."""
        reg._incidents[incident.incident_id] = incident
        for ref in incident.entity_refs:
            reg._by_entity.setdefault(ref, []).append(incident.incident_id)

    def _candidates(self):
        early = Incident(
            incident_id="ffffffff-ffff-4fff-8fff-ffffffffffff",  # lexically last
            entity_refs=["vessel:V1"],
            created_at=at(minutes=0),  # but earliest created_at -> must win
            last_signal_at=at(minutes=1),
        )
        late = Incident(
            incident_id="00000000-0000-4000-8000-000000000000",  # lexically first
            entity_refs=["vessel:V1"],
            created_at=at(minutes=5),
            last_signal_at=at(minutes=6),
        )
        return early, late

    def test_earliest_created_at_wins_regardless_of_insertion_order(self):
        early, late = self._candidates()

        for order in ([early, late], [late, early]):
            reg = IncidentRegistry()
            for inc in order:
                self._register(reg, inc)

            result = reg.correlate(make_signal(["vessel:V1"], at(minutes=10)))

            assert result.created is False
            assert result.incident.incident_id == early.incident_id

    def test_lowest_incident_id_breaks_created_at_ties(self):
        a = Incident(
            incident_id="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            entity_refs=["vessel:V1"],
            created_at=at(minutes=0),
            last_signal_at=at(minutes=0),
        )
        b = Incident(
            incident_id="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",  # lower id, same created_at
            entity_refs=["vessel:V1"],
            created_at=at(minutes=0),
            last_signal_at=at(minutes=0),
        )

        for order in ([a, b], [b, a]):
            reg = IncidentRegistry()
            for inc in order:
                self._register(reg, inc)

            result = reg.correlate(make_signal(["vessel:V1"], at(minutes=5)))

            assert result.incident.incident_id == b.incident_id


# ---------------------------------------------------------------------------
# CORRELATE trace entry on both the new and matched paths.
# ---------------------------------------------------------------------------


class TestCorrelateTraceEntry:
    def test_new_incident_path_appends_correlate_entry_with_matched_false(self):
        reg = IncidentRegistry()

        signal = make_signal(["vessel:V1"], at(minutes=0))
        result = reg.correlate(signal)
        entry = result.incident.trace[-1]

        assert entry.stage == "CORRELATE"
        assert entry.detail["matched"] is False
        assert entry.detail["signal_type"] == "vessel_eta"
        assert entry.detail["entity_refs"] == ["vessel:V1"]
        assert entry.detail["incident_id"] == result.incident.incident_id
        assert entry.error is None
        # Trace step is stamped with the signal's own time, not wall-clock.
        assert entry.timestamp == signal.received_at

    def test_matched_path_appends_correlate_entry_with_matched_true(self):
        reg = IncidentRegistry()

        reg.correlate(make_signal(["vessel:V1"], at(minutes=0)))
        signal = make_signal(["vessel:V1", "berth:B1"], at(minutes=5))
        result = reg.correlate(signal)

        assert result.created is False
        entry = result.incident.trace[-1]
        assert entry.stage == "CORRELATE"
        assert entry.detail["matched"] is True
        assert entry.detail["entity_refs"] == ["vessel:V1", "berth:B1"]
        assert entry.timestamp == signal.received_at
        # One CORRELATE entry per correlate() call.
        assert [e.stage for e in result.incident.trace] == ["CORRELATE", "CORRELATE"]

    def test_no_second_incident_for_entity_and_trace_ends_with_matched_correlate(self):
        # Acceptance criterion wording.
        reg = IncidentRegistry()

        first = reg.correlate(make_signal(["vessel:V1"], at(minutes=0)))
        reg.correlate(make_signal(["vessel:V1"], at(minutes=5)))

        assert len(reg._by_entity["vessel:V1"]) == 1
        assert reg.get(first.incident.incident_id).trace[-1].detail["matched"] is True


# ---------------------------------------------------------------------------
# Guards: empty entity_refs, ref de-dup, resolved-incident, parse tolerance.
# ---------------------------------------------------------------------------


class TestEmptyEntityRefsGuard:
    def test_signal_with_no_entity_refs_raises(self):
        reg = IncidentRegistry()

        with pytest.raises(ValueError):
            reg.correlate(make_signal([], at(minutes=0)))


class TestEntityRefDedup:
    def test_duplicate_refs_in_one_signal_are_collapsed(self):
        reg = IncidentRegistry()

        result = reg.correlate(make_signal(["vessel:V1", "vessel:V1"], at(minutes=0)))

        assert result.incident.entity_refs == ["vessel:V1"]
        assert len(reg._by_entity["vessel:V1"]) == 1


class TestResolvedIncidentGuard:
    def test_resolved_incident_is_never_a_correlation_target(self):
        reg = IncidentRegistry()

        resolved = Incident(
            incident_id="dddddddd-dddd-4ddd-8ddd-dddddddddddd",
            status="resolved",
            entity_refs=["vessel:V1"],
            created_at=at(minutes=0),
            last_signal_at=at(minutes=0),
        )
        reg._incidents[resolved.incident_id] = resolved
        reg._by_entity.setdefault("vessel:V1", []).append(resolved.incident_id)

        result = reg.correlate(make_signal(["vessel:V1"], at(minutes=5)))

        assert result.created is True
        assert result.incident.incident_id != resolved.incident_id


class TestParseIsoTolerance:
    def test_z_suffixed_signal_timestamp_correlates_against_aware_incident(self):
        reg = IncidentRegistry()

        first = reg.correlate(make_signal(["vessel:V1"], at(minutes=0)))
        second = reg.correlate(make_signal(["vessel:V1"], "2026-08-27T10:05:00Z"))

        assert second.created is False
        assert second.incident.incident_id == first.incident.incident_id

    def test_naive_signal_timestamp_correlates_against_aware_incident(self):
        reg = IncidentRegistry()

        first = reg.correlate(make_signal(["vessel:V1"], at(minutes=0)))
        second = reg.correlate(make_signal(["vessel:V1"], "2026-08-27T10:05:00"))

        assert second.created is False
        assert second.incident.incident_id == first.incident.incident_id
