"""Unit tests for Story 1.1: Signal Ingestion & Normalization.

Covers the 3 I/O matrix scenarios from the spec across all 7 supported
signal types:
  1. Valid signal -> normalized `Signal` with correct `entity_refs`.
  2. Unrecognized/malformed signal -> `RejectedSignal` with a reason, never
     an unhandled exception.
  3. Two different-type signals referencing the same entity -> identical
     `entity_refs`.
"""

from datetime import datetime

import pytest

import ingestion.normalize as normalize_module
from ingestion.normalize import make_entity_ref, normalize_signal
from models.signal import RejectedSignal, Signal

# ---------------------------------------------------------------------------
# One valid raw payload per supported signal type, plus the entity_refs it
# is expected to normalize to.
# ---------------------------------------------------------------------------

VALID_SIGNALS = [
    (
        "vessel_eta",
        {"type": "vessel_eta", "vessel_id": "MSC-ANNA", "eta": "2026-08-27T10:00:00Z", "berth_id": "C7-3"},
        ["vessel:MSC-ANNA", "berth:C7-3"],
    ),
    (
        "crane_alert",
        {"type": "crane_alert", "crane_id": "CRANE-9", "berth_id": "C7-3", "alert_type": "breakdown"},
        ["berth:C7-3"],
    ),
    (
        "yard_metric",
        {"type": "yard_metric", "yard_block_id": "YB-4", "berth_id": "C7-3", "congestion_level": 0},
        ["berth:C7-3"],
    ),
    (
        "gate_metric",
        {"type": "gate_metric", "gate_id": "GATE-2", "queue_length": 12},
        ["gate:GATE-2"],
    ),
    (
        "weather_event",
        {"type": "weather_event", "area_id": "TUAS", "condition": "storm"},
        ["area:TUAS"],
    ),
    (
        "dg_exception",
        {"type": "dg_exception", "container_id": "CNT-1", "vessel_id": "MSC-ANNA", "exception_type": "segregation"},
        ["container:CNT-1"],
    ),
    (
        "operator_request",
        {"type": "operator_request", "entity_type": "berth", "entity_id": "C7-3", "request_type": "reprioritize"},
        ["berth:C7-3"],
    ),
]

# Required fields per type, used to build "missing field" rejection cases.
REQUIRED_FIELDS = {
    "vessel_eta": ["vessel_id", "eta"],
    "crane_alert": ["crane_id", "berth_id", "alert_type"],
    "yard_metric": ["yard_block_id", "berth_id", "congestion_level"],
    "gate_metric": ["gate_id", "queue_length"],
    "weather_event": ["area_id", "condition"],
    "dg_exception": ["container_id", "vessel_id", "exception_type"],
    "operator_request": ["entity_type", "entity_id", "request_type"],
}


class TestValidSignals:
    @pytest.mark.parametrize("signal_type,raw,expected_refs", VALID_SIGNALS, ids=[s[0] for s in VALID_SIGNALS])
    def test_normalizes_to_signal_with_expected_entity_refs(self, signal_type, raw, expected_refs):
        result = normalize_signal(raw)

        assert isinstance(result, Signal)
        assert result.signal_type == signal_type
        assert result.entity_refs == expected_refs
        assert result.payload == raw
        assert isinstance(result.received_at, str) and result.received_at != ""
        # received_at must be a genuinely well-formed, parseable ISO 8601
        # timestamp, not merely a non-empty string.
        datetime.fromisoformat(result.received_at)

    def test_vessel_eta_without_berth_id_omits_berth_ref(self):
        # berth_id is the only optional field in the whole module; every
        # VALID_SIGNALS vessel_eta fixture always supplies it, so this is
        # the sole coverage of the "absent" branch.
        raw = {"type": "vessel_eta", "vessel_id": "MSC-ANNA", "eta": "2026-08-27T10:00:00Z"}

        result = normalize_signal(raw)

        assert isinstance(result, Signal)
        assert result.entity_refs == ["vessel:MSC-ANNA"]

    def test_no_field_confusion_between_types(self):
        # Each valid signal must produce a Signal typed with its own signal_type,
        # not another type's.
        results = [normalize_signal(raw) for _, raw, _ in VALID_SIGNALS]
        assert all(isinstance(r, Signal) for r in results)
        assert [r.signal_type for r in results] == [s[0] for s in VALID_SIGNALS]


class TestRejectedSignals:
    def test_unrecognized_type_is_rejected(self):
        result = normalize_signal({"type": "unknown_signal_type", "foo": "bar"})

        assert isinstance(result, RejectedSignal)
        assert "unrecognized" in result.reason.lower()
        assert result.raw == {"type": "unknown_signal_type", "foo": "bar"}

    def test_missing_type_key_is_rejected(self):
        result = normalize_signal({"vessel_id": "MSC-ANNA"})

        assert isinstance(result, RejectedSignal)
        assert result.reason

    def test_non_dict_input_is_rejected_without_raising(self):
        for bad_input in [None, "not a dict", 42, ["a", "list"]]:
            result = normalize_signal(bad_input)
            assert isinstance(result, RejectedSignal)
            assert result.reason

    @pytest.mark.parametrize(
        "signal_type,raw,_expected",
        VALID_SIGNALS,
        ids=[s[0] for s in VALID_SIGNALS],
    )
    def test_missing_required_field_is_rejected_per_type(self, signal_type, raw, _expected):
        for missing_field in REQUIRED_FIELDS[signal_type]:
            malformed = dict(raw)
            del malformed[missing_field]

            result = normalize_signal(malformed)

            assert isinstance(result, RejectedSignal), (
                f"{signal_type} missing '{missing_field}' should be rejected"
            )
            assert missing_field in result.reason
            assert result.raw == malformed

    @pytest.mark.parametrize(
        "signal_type,raw,_expected",
        VALID_SIGNALS,
        ids=[s[0] for s in VALID_SIGNALS],
    )
    def test_empty_string_required_field_is_rejected_per_type(self, signal_type, raw, _expected):
        for field in REQUIRED_FIELDS[signal_type]:
            if not isinstance(raw[field], str):
                continue
            malformed = dict(raw)
            malformed[field] = "   "

            result = normalize_signal(malformed)

            assert isinstance(result, RejectedSignal)
            assert field in result.reason

    def test_operator_request_unrecognized_entity_type_is_rejected(self):
        raw = {"type": "operator_request", "entity_type": "berht", "entity_id": "C7-3", "request_type": "reprioritize"}

        result = normalize_signal(raw)

        assert isinstance(result, RejectedSignal)
        assert "entity_type" in result.reason


class TestCrossTypeEntityCorrelation:
    def test_crane_alert_and_yard_metric_same_berth_produce_identical_entity_refs(self):
        crane_alert = {"type": "crane_alert", "crane_id": "CRANE-9", "berth_id": "C7-3", "alert_type": "breakdown"}
        yard_metric = {"type": "yard_metric", "yard_block_id": "YB-4", "berth_id": "C7-3", "congestion_level": 5}

        crane_result = normalize_signal(crane_alert)
        yard_result = normalize_signal(yard_metric)

        assert isinstance(crane_result, Signal)
        assert isinstance(yard_result, Signal)
        assert crane_result.entity_refs == ["berth:C7-3"]
        assert yard_result.entity_refs == ["berth:C7-3"]
        assert crane_result.entity_refs == yard_result.entity_refs

    def test_operator_request_and_crane_alert_same_berth_produce_identical_entity_refs(self):
        operator_request = {
            "type": "operator_request",
            "entity_type": "berth",
            "entity_id": "C7-3",
            "request_type": "reprioritize",
        }
        crane_alert = {"type": "crane_alert", "crane_id": "CRANE-1", "berth_id": "C7-3", "alert_type": "delay"}

        op_result = normalize_signal(operator_request)
        crane_result = normalize_signal(crane_alert)

        assert op_result.entity_refs == crane_result.entity_refs == ["berth:C7-3"]


class TestMakeEntityRef:
    def test_builds_fixed_type_id_format(self):
        assert make_entity_ref("vessel", "MSC-ANNA") == "vessel:MSC-ANNA"
        assert make_entity_ref("berth", "C7-3") == "berth:C7-3"


class TestHandlerCount:
    def test_exactly_7_supported_signal_types(self):
        # The module docstring claims "7 supported raw signal types"; this
        # guards against _HANDLERS drifting from that claim silently.
        assert len(normalize_module._HANDLERS) == 7
