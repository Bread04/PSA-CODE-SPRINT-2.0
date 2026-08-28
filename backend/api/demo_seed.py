"""Deterministic demo incidents for `npm run dev` and manual API poking.

Enabled by default; set `PORTWATCH_SEED=0` to start empty. Not used by tests
(they seed their own fixtures). Mirrors the shapes the console renders: a held
Tier 3 card with alternatives, a kill-switch-blocked Tier 1/2, a couple of
resolved incidents (auto / approved / rejected), an in-progress one, and a
`demo-load-balancing` incident (Spec 3.2 / FR17: Tuas C7 under pressure,
recommended reroute to Pasir Panjang P2, per-block utilization carried on its
CORRELATE payload so the IncidentDetail "Yard load" row renders).
"""

from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone

from agents.yard_load_balancing import format_block_utilization
from models.incident import Incident, TraceEntry
from models.recovery import PredictedImpact, RecoveryOption

_NOW = datetime(2026, 8, 28, 8, 15, tzinfo=timezone.utc)


def _iso(minutes_ago: int) -> str:
    return (_NOW - timedelta(minutes=minutes_ago)).isoformat()


def _opt(oid: str, desc: str, *, dg: bool = False, delay: int = 30) -> RecoveryOption:
    return RecoveryOption(
        option_id=oid,
        description=desc,
        predicted_impact=PredictedImpact(delay_min=delay, cost="medium", yard_impact="minor reshuffle", risk="low"),
        reversible=True,
        dg_involved=dg,
    )


def _tr(stage: str, mins: int, detail: dict | None = None, error: dict | None = None) -> TraceEntry:
    return TraceEntry(stage=stage, timestamp=_iso(mins), detail=detail or {}, error=error)


def demo_incidents() -> list[Incident]:
    return [
        Incident(
            incident_id="demo-tier3-alts",
            status="open",
            entity_refs=["vessel:MSC-ANNA", "berth:B3"],
            tier=3,
            confidence=67,
            recommended_option_id="opt-2",
            options=[
                _opt("opt-1", "Hold MSC Anna at anchorage for 2h", delay=120),
                _opt("opt-2", "Reassign MSC Anna to Berth C7, slot 5; reroute yard moves via Crane #6", delay=35),
                _opt("opt-3", "Swap berth window with EVER GIVEN", dg=True, delay=45),
            ],
            approval_status="pending",
            created_at=_iso(22),
            last_signal_at=_iso(4),
            trace=[
                _tr("CORRELATE", 22, {"signal_type": "eta_slip", "matched": False}),
                _tr("AGENT_CALL", 18, {"agent": "crane", "note": "Crane #7 telemetry timeout"},
                    error={"stage": "AGENT_CALL", "error": "crane #7 telemetry timeout", "retried": True, "fallback_used": True}),
                _tr("CONFIDENCE", 16, {"reason": "Down from 91% — Crane #7 telemetry timed out; using last known state"}),
                _tr("POLICY_DECISION", 15, {"tier": 3}),
                _tr("DG_CHECK", 15, {"rejected_option": "opt-3", "reason": "DG/IMDG segregation conflict"}),
                _tr("APPROVAL", 14, {"blocked": True, "tier": 3}),
            ],
        ),
        Incident(
            incident_id="demo-ks-blocked",
            status="open",
            entity_refs=["gate:G2"],
            tier=1,
            confidence=94,
            recommended_option_id="opt-1",
            options=[_opt("opt-1", "Refresh gate appointment schedule")],
            approval_status="n/a",
            blocked_by_kill_switch=True,
            created_at=_iso(12),
            last_signal_at=_iso(9),
            trace=[
                _tr("CORRELATE", 12, {"signal_type": "gate_congestion"}),
                _tr("POLICY_DECISION", 10, {"tier": 1}),
                _tr("EXECUTE", 9, {"blocked": True},
                    error={"stage": "EXECUTE", "error": "global kill switch engaged", "retried": False, "fallback_used": False}),
            ],
        ),
        Incident(
            incident_id="demo-auto-resolved",
            status="resolved",
            entity_refs=["yard:Y4"],
            tier=1,
            confidence=100,
            recommended_option_id="opt-1",
            options=[_opt("opt-1", "Adjust appointment slots for block Y4")],
            approval_status="n/a",
            created_at=_iso(140),
            last_signal_at=_iso(133),
            trace=[
                _tr("CORRELATE", 140, {"signal_type": "yard_congestion"}),
                _tr("POLICY_DECISION", 138, {"tier": 1}),
                _tr("EXECUTE", 137, {"tier": 1, "results": [{"service": "tos", "ok": True}]}),
                _tr("VERIFY", 136, {"all_ok": True}),
            ],
        ),
        Incident(
            incident_id="demo-approved",
            status="resolved",
            entity_refs=["vessel:EVER-GIVEN", "crane:C4"],
            tier=3,
            confidence=88,
            recommended_option_id="opt-1",
            options=[_opt("opt-1", "Reassign Crane #4 workload to Crane #6")],
            approval_status="approved",
            created_at=_iso(200),
            last_signal_at=_iso(190),
            trace=[
                _tr("CORRELATE", 200, {"signal_type": "crane_fault"}),
                _tr("POLICY_DECISION", 197, {"tier": 3}),
                _tr("APPROVAL", 195, {"action": "approve", "operator": True}),
                _tr("EXECUTE", 194, {"tier": 3, "results": [{"service": "tos", "ok": True}, {"service": "crane_scheduler", "ok": True}]}),
                _tr("VERIFY", 193, {"all_ok": True}),
            ],
        ),
        Incident(
            incident_id="demo-rejected",
            status="resolved",
            entity_refs=["vessel:TITAN"],
            tier=3,
            confidence=72,
            recommended_option_id="opt-1",
            options=[_opt("opt-1", "Delay TITAN departure by 90 minutes", delay=90)],
            approval_status="rejected",
            created_at=_iso(320),
            last_signal_at=_iso(310),
            trace=[
                _tr("CORRELATE", 320, {"signal_type": "berth_conflict"}),
                _tr("POLICY_DECISION", 317, {"tier": 3}),
                _tr("APPROVAL", 315, {"action": "reject", "operator": True}),
            ],
        ),
        Incident(
            incident_id="demo-in-progress",
            status="open",
            entity_refs=["vessel:OOCL-TOKYO"],
            tier=2,
            confidence=91,
            recommended_option_id="opt-1",
            options=[_opt("opt-1", "Shift OOCL Tokyo to the next available window")],
            approval_status="n/a",
            created_at=_iso(6),
            last_signal_at=_iso(2),
            trace=[
                _tr("CORRELATE", 6, {"signal_type": "eta_slip"}),
                _tr("POLICY_DECISION", 4, {"tier": 2}),
                _tr("EXECUTE", 3, {"tier": 2, "results": [{"service": "tos", "ok": True}]}),
            ],
        ),
        _load_balancing_incident(),
    ]


def _load_balancing_incident() -> Incident:
    """Spec 3.2 (FR17): a Tuas-C7-under-pressure incident whose recommended
    option reroutes flow to Pasir Panjang P2, with both blocks' utilization on
    the CORRELATE payload so the IncidentDetail "Yard load" row renders."""
    util = {"tuas_c7": 0.93, "pasir_panjang_p2": 0.44}
    option = RecoveryOption(
        option_id="opt-1",
        description=f"Route ~600 TEU of import flow to Pasir Panjang P2 ({format_block_utilization(util)})",
        predicted_impact=PredictedImpact(
            delay_min=35,
            cost="medium",
            yard_impact="Tuas C7 relieved to ~78%; Pasir Panjang P2 rises to ~52%",
            risk="low",
        ),
        reversible=True,
        dg_involved=False,
    )
    return Incident(
        incident_id="demo-load-balancing",
        status="open",
        entity_refs=["yard:TUAS-C7", "yard:PASIR-PANJANG-P2"],
        tier=2,
        confidence=91,
        recommended_option_id="opt-1",
        options=[option],
        approval_status="n/a",
        created_at=_iso(19),
        last_signal_at=_iso(5),
        trace=[
            _tr("CORRELATE", 19, {"signal_type": "yard_congestion", "matched": False, "payload": {"yard_utilization": util}}),
            _tr("POLICY_DECISION", 17, {"tier": 2}),
            _tr("EXECUTE", 16, {"tier": 2, "results": [{"service": "tos", "ok": True}]}),
        ],
    )


def seed_demo() -> int:
    """Insert demo incidents into the global state unless `PORTWATCH_SEED=0`. Returns the count added."""
    if os.environ.get("PORTWATCH_SEED", "1") == "0":
        return 0
    from api.state import add_incident, list_incidents  # noqa: PLC0415 - avoid import cycle at module load

    if list_incidents():
        return 0
    incidents = demo_incidents()
    for inc in incidents:
        add_incident(inc)
    return len(incidents)
