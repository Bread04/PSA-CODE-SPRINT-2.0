"""Spec 3.2: lock the `demo-load-balancing` seed's shape against silent regression.

The frontend `yardBlockUtilization` helper reads the newest `CORRELATE` trace
entry's `detail.payload.yard_utilization.{tuas_c7,pasir_panjang_p2}`; this test
walks that exact path on the seeded incident, and checks the recommended option
carries the `format_block_utilization` string.
"""

from __future__ import annotations

from agents.yard_load_balancing import format_block_utilization
from api.demo_seed import demo_incidents


def _load_balancing_incident():
    matches = [i for i in demo_incidents() if i.incident_id == "demo-load-balancing"]
    assert len(matches) == 1, "expected exactly one demo-load-balancing incident"
    return matches[0]


def test_correlate_payload_carries_numeric_per_block_utilization():
    incident = _load_balancing_incident()

    correlate_entries = [e for e in incident.trace if e.stage == "CORRELATE"]
    assert correlate_entries, "seed must carry a CORRELATE trace entry"
    last = correlate_entries[-1]

    util = last.detail["payload"]["yard_utilization"]
    assert isinstance(util["tuas_c7"], (int, float))
    assert isinstance(util["pasir_panjang_p2"], (int, float))
    assert not isinstance(util["tuas_c7"], bool)
    assert not isinstance(util["pasir_panjang_p2"], bool)


def test_recommended_option_description_contains_the_block_utilization_string():
    incident = _load_balancing_incident()

    last = [e for e in incident.trace if e.stage == "CORRELATE"][-1]
    util = last.detail["payload"]["yard_utilization"]

    rendered = format_block_utilization(util)
    assert rendered, "format_block_utilization must be non-empty for the seed's util"

    recommended = next(
        o for o in incident.options if o.option_id == incident.recommended_option_id
    )
    assert rendered in recommended.description
