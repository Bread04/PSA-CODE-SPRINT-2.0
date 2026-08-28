"""Spec 3.1: deterministic proof that N independent incidents can be driven
through the real policy/execution pipeline *concurrently* without any
cross-incident leakage.

Source of truth: _bmad-output/implementation-artifacts/spec-3-1-concurrent-incident-proof.md.

Design
------
* Each incident is created the only way the system allows - via
  `IncidentRegistry.correlate()` from a distinct-entity-ref `Signal`.
* All incidents are run through `run_policy_and_execution` concurrently with
  `asyncio.gather` (one task per incident, one owning orchestrator task each).
* The mock-service `execute_registry` is injected. Its `tos` service awaits an
  `asyncio.Barrier` whose party count equals the number of incidents that will
  actually reach execution, and a shared tracker records `max_in_flight`. When
  every executing incident is simultaneously parked on that barrier,
  `max_in_flight` proves they ran at the same time (mirrors the specialists
  test's `FakeAsyncAnthropic.max_in_flight == 3` proof).
* Global state is reset before every run (`reset_kill_switch_for_tests`,
  `reset_mock_agents`) so incidents are fully independent.
* Isolation is asserted per incident: distinct `incident_id`s, append-only
  traces that never reference another incident's id, and independent tiers /
  status / kill-switch flags.

No production code under backend/ is modified. The pipeline is driven directly
(never through api/state.py).
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass

from models.incident import Incident
from models.recovery import PredictedImpact, RecoveryOption
from models.signal import Signal

from agents.arbiter import ArbiterResult
from agents.mock_override import reset_mock_agents

from registry.incident_registry import IncidentRegistry

from policy.killswitch import (
    engage_kill_switch,
    is_kill_switch_engaged,
    reset_kill_switch_for_tests,
)

from orchestrator.run import run_policy_and_execution

from mock_services.services import MockService, SERVICE_NAMES


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
def _opt(
    *,
    reversible: bool = True,
    risk: str = "low",
    cost: str = "low",
    delay: int = 30,
    dg: bool = False,
    description: str = "recover in place",
) -> RecoveryOption:
    return RecoveryOption(
        option_id="opt-1",  # stamped by the arbiter/run layer; harmless here
        description=description,
        predicted_impact=PredictedImpact(delay_min=delay, cost=cost, yard_impact="minor", risk=risk),
        reversible=reversible,
        dg_involved=dg,
    )


def _arbiter(options: list[RecoveryOption]) -> ArbiterResult:
    return ArbiterResult(
        options=options,
        specialist_disagreement=False,
        disagreement_summary="",
    )


def _correlate(ref: str, *, t: str = "berth_blocked", received_at: str = "2026-08-27T10:00:00Z") -> Incident:
    """Create a fresh, independent incident via the only legal creator."""
    reg = IncidentRegistry()
    signal = Signal(
        entity_refs=[ref],
        signal_type=t,
        payload={},
        received_at=received_at,
    )
    return reg.correlate(signal).incident


# --- concurrency instrumentation ------------------------------------------- #
@dataclass
class _ConcurrencyTracker:
    in_flight: int = 0
    max_in_flight: int = 0


class _BarrierService:
    """MockService whose `tos` call parks on a barrier to force simultaneity."""

    def __init__(self, name: str, barrier: asyncio.Barrier | None, tracker: _ConcurrencyTracker, *, fail: bool = False):
        self.name = name
        self._barrier = barrier
        self._tracker = tracker
        self._fail = fail

    async def execute(self, action):  # noqa: ANN001 - matches MockService duck type
        self._tracker.in_flight += 1
        self._tracker.max_in_flight = max(self._tracker.max_in_flight, self._tracker.in_flight)
        try:
            if self._barrier is not None:
                await self._barrier.wait()
            else:
                await asyncio.sleep(0)
            if self._fail:
                return {"ok": False, "result": None, "error": f"{self.name}: simulated failure"}
            return {"ok": True, "result": {"service": self.name}, "error": None}
        finally:
            self._tracker.in_flight -= 1


def _build_registry(tracker: _ConcurrencyTracker, barrier: asyncio.Barrier | None, *, failing=None):
    failing = failing or set()
    reg = {}
    for name in SERVICE_NAMES:
        if name == "tos":
            reg[name] = _BarrierService(name, barrier, tracker, fail=(name in failing))
        else:
            reg[name] = MockService(name, fail=(name in failing))
    return reg


async def _drive(incidents, arbs, *, failing=None, barrier_parties: int = 0):
    """Run every (incident, arbiter_result) concurrently through the real pipeline."""
    tracker = _ConcurrencyTracker()
    barrier = asyncio.Barrier(barrier_parties) if barrier_parties > 0 else None
    registry = _build_registry(tracker, barrier, failing=failing)

    async def _one(inc: Incident, arb: ArbiterResult):
        return await run_policy_and_execution(inc, arb, execute_registry=registry, staleness_seconds=0)

    # wait_for fails fast instead of hanging forever if a barrier party count
    # is ever mis-matched (defensive; current I/O rows are balanced).
    results = await asyncio.wait_for(
        asyncio.gather(*(_one(i, a) for i, a in zip(incidents, arbs))),
        timeout=30,
    )
    return results, tracker


def _reset_globals() -> None:
    reset_kill_switch_for_tests()
    reset_mock_agents()


def _assert_isolated(incidents: list[Incident]) -> None:
    """No incident's trace may reference another incident's id (AD-4)."""
    ids = {inc.incident_id for inc in incidents}
    assert len(ids) == len(incidents), "incident_id collision under concurrency"
    for inc in incidents:
        for entry in inc.trace:
            detail = entry.detail or {}
            ref_id = detail.get("incident_id")
            if ref_id is not None:
                assert ref_id == inc.incident_id, (
                    f"trace leakage: {inc.incident_id} carries entry referencing {ref_id}"
                )


# --------------------------------------------------------------------------- #
# I/O matrix row: HAPPY_PATH - 3 independent low-risk incidents, all auto-run
# --------------------------------------------------------------------------- #
def test_concurrent_happy_path_isolated_and_simultaneous():
    _reset_globals()
    incidents = [
        _correlate("vessel:VOY-HAPPY-A"),
        _correlate("vessel:VOY-HAPPY-B"),
        _correlate("vessel:VOY-HAPPY-C"),
    ]
    arbs = [_arbiter([_opt()]) for _ in incidents]  # each -> Tier 1, confidence 100

    results, tracker = asyncio.run(_drive(incidents, arbs, barrier_parties=3))

    # Distinct, isolated incidents.
    _assert_isolated(incidents)
    assert len({inc.incident_id for inc in incidents}) == 3

    # Every incident executed autonomously.
    for inc, res in zip(incidents, results):
        assert inc.tier == 1
        assert inc.status == "resolved"
        assert inc.blocked_by_kill_switch is False
        assert res["execution_results"] is not None
        assert all(r.get("ok") for r in res["execution_results"])

    # All three were mid-execution at the same instant (concurrency proof).
    assert tracker.max_in_flight == 3


# --------------------------------------------------------------------------- #
# I/O matrix row: MIXED_TIERS - concurrent Tier 1, Tier 2, and a held Tier 3
# --------------------------------------------------------------------------- #
def test_concurrent_mixed_tiers_isolated():
    _reset_globals()
    tier1 = _correlate("vessel:VOY-MIX-A")      # auto-executes
    tier2 = _correlate("vessel:VOY-MIX-B")      # auto-executes
    tier3 = _correlate("vessel:VOY-MIX-C")      # held for approval (DG)

    incidents = [tier1, tier2, tier3]
    # Tier 3 option carries DG involvement -> must NOT execute, only 2 hit `tos`.
    arbs = [
        _arbiter([_opt()]),
        _arbiter([_opt(risk="medium", cost="medium", delay=50)]),
        _arbiter([_opt(dg=True, delay=200)]),
    ]

    results, tracker = asyncio.run(_drive(incidents, arbs, barrier_parties=2))

    _assert_isolated(incidents)
    assert len({inc.incident_id for inc in incidents}) == 3

    # Executing incidents resolved; held incident stays open + pending approval.
    assert tier1.tier == 1 and tier1.status == "resolved"
    assert tier2.tier == 2 and tier2.status == "resolved"
    assert tier3.tier == 3 and tier3.status == "open"
    assert tier3.approval_status == "pending"
    assert results[2]["execution_results"] is None

    # Two of the three ran simultaneously.
    assert tracker.max_in_flight == 2


# --------------------------------------------------------------------------- #
# I/O matrix row: KILLSWITCH_ENGAGED - concurrent, but nothing executes
# --------------------------------------------------------------------------- #
def test_concurrent_killswitch_blocks_all_without_bleed():
    _reset_globals()
    engage_kill_switch()
    assert is_kill_switch_engaged() is True

    incidents = [
        _correlate("vessel:VOY-KS-A"),
        _correlate("vessel:VOY-KS-B"),
        _correlate("vessel:VOY-KS-C"),
    ]
    arbs = [_arbiter([_opt()]) for _ in incidents]  # would be Tier 1 if not blocked

    # barrier_parties=0: no incident reaches execution under the kill switch.
    results, tracker = asyncio.run(_drive(incidents, arbs, barrier_parties=0))

    _assert_isolated(incidents)
    assert len({inc.incident_id for inc in incidents}) == 3

    for inc, res in zip(incidents, results):
        # Tiers are computed, but execution is blocked and status stays open.
        assert inc.tier == 1
        assert inc.blocked_by_kill_switch is True
        assert inc.status == "open"
        assert res["execution_results"] in (None, [])

    # Nothing ever entered the execution layer.
    assert tracker.max_in_flight == 0

    # Follow-up run after reset must behave cleanly (no bleed from the engaged run).
    reset_kill_switch_for_tests()
    assert is_kill_switch_engaged() is False
    fresh = [_correlate(f"vessel:VOY-KS-FOLLOW-{i}") for i in range(3)]
    farbs = [_arbiter([_opt()]) for _ in fresh]
    follow, follow_tracker = asyncio.run(_drive(fresh, farbs, barrier_parties=3))
    _assert_isolated(fresh)
    for inc, res in zip(fresh, follow):
        assert inc.status == "resolved"
        assert res["execution_results"] is not None
        assert all(r.get("ok") for r in res["execution_results"])
    assert follow_tracker.max_in_flight == 3


# --------------------------------------------------------------------------- #
# I/O matrix row: CONCURRENT_ENTITIES - incidents that share an entity ref run
# together without merging or cross-contamination.
#
# NOTE: the registry merges signals whose entity refs overlap *within* the 15
# minute CORRELATION_WINDOW. To exercise the "shared entity stays per-incident,
# no merged trace" guarantee we share a ref but space the signals >15 min apart
# so correlation keeps them as two independent Incidents (mirrors the real case
# of the same berth used by two vessels at different times).
# --------------------------------------------------------------------------- #
def test_concurrent_entities_stay_isolated():
    _reset_globals()
    reg = IncidentRegistry()  # single shared registry for this scenario
    incidents = [
        reg.correlate(
            Signal(entity_refs=["berth:BERTH-7", "vessel:VOY-ENT-A"], signal_type="berth_blocked", payload={}, received_at="2026-08-27T10:00:00Z")
        ).incident,
        reg.correlate(
            Signal(entity_refs=["berth:BERTH-7", "vessel:VOY-ENT-B"], signal_type="crane_fault", payload={}, received_at="2026-08-27T10:20:00Z")
        ).incident,
    ]
    arbs = [_arbiter([_opt()]) for _ in incidents]

    results, tracker = asyncio.run(_drive(incidents, arbs, barrier_parties=2))

    # Two distinct incidents even though they share `berth:BERTH-7`.
    ids = {inc.incident_id for inc in incidents}
    assert len(ids) == 2
    assert len(reg._by_entity["berth:BERTH-7"]) == 2, "shared ref must stay per-incident (no merge)"
    assert set(reg._by_entity["berth:BERTH-7"]) == ids

    _assert_isolated(incidents)

    for inc, res in zip(incidents, results):
        assert inc.tier == 1
        assert inc.status == "resolved"
        assert res["execution_results"] is not None
        # The CORRELATE entry must reference only this incident's own refs.
        correlate = next(e for e in inc.trace if e.stage == "CORRELATE")
        assert set(correlate.detail.get("entity_refs", [])) == set(inc.entity_refs)

    # Both shared-entity incidents were processed simultaneously.
    assert tracker.max_in_flight == 2
