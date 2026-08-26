"""Signal ingestion & normalization (Story 1.1 / FR1).

`normalize_signal()` converts a raw signal dict (one of 7 supported raw
signal types) into the common `Signal` representation, or returns a
`RejectedSignal` carrying a logged reason for unrecognized/malformed input.

This module is a pure function library: no I/O, no network, no DB calls.
`make_entity_ref()` is factored out on its own because later stories'
mock services (Yard Manager, AGV/Gate) must independently produce the exact
same `entity_refs` string format - a shared helper prevents the two sides
from drifting on string formatting.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Callable

from models.signal import RejectedSignal, Signal

# ---------------------------------------------------------------------------
# Shared entity-id helper (also reused by mock services, per architecture's
# cross-lane id-format convention).
# ---------------------------------------------------------------------------


def make_entity_ref(entity_type: str, entity_id: str) -> str:
    """Build an entity reference string in the fixed 'type:id' convention."""
    return f"{entity_type}:{entity_id}"


# Known entity types used elsewhere in this module (vessel_eta, crane_alert/
# yard_metric via berth, gate_metric, weather_event, dg_exception). Used to
# validate the caller-supplied `entity_type` on `operator_request` payloads,
# since that is the only signal type where entity_type is free-form input
# rather than implied by the handler itself.
_VALID_ENTITY_TYPES = {"vessel", "berth", "crane", "gate", "area", "container"}


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _is_missing(value: object) -> bool:
    """A field is considered missing if absent, None, or an empty/whitespace string."""
    if value is None:
        return True
    if isinstance(value, str) and value.strip() == "":
        return True
    return False


def _missing_fields(raw: dict, required: list[str]) -> list[str]:
    return [field for field in required if _is_missing(raw.get(field))]


# ---------------------------------------------------------------------------
# Per-signal-type handlers.
#
# Each handler receives the raw dict and returns (entity_refs, missing_fields).
# If missing_fields is non-empty, the signal is rejected.
# ---------------------------------------------------------------------------


def _handle_vessel_eta(raw: dict) -> tuple[list[str], list[str]]:
    missing = _missing_fields(raw, ["vessel_id", "eta"])
    if missing:
        return [], missing
    refs = [make_entity_ref("vessel", raw["vessel_id"])]
    if not _is_missing(raw.get("berth_id")):
        refs.append(make_entity_ref("berth", raw["berth_id"]))
    return refs, []


def _handle_crane_alert(raw: dict) -> tuple[list[str], list[str]]:
    # Correlatable entity is the berth the crane operates at: crane alerts,
    # yard-congestion metrics, etc. correlate on the berth they affect.
    missing = _missing_fields(raw, ["crane_id", "berth_id", "alert_type"])
    if missing:
        return [], missing
    return [make_entity_ref("berth", raw["berth_id"])], []


def _handle_yard_metric(raw: dict) -> tuple[list[str], list[str]]:
    missing = _missing_fields(raw, ["yard_block_id", "berth_id", "congestion_level"])
    if missing:
        return [], missing
    return [make_entity_ref("berth", raw["berth_id"])], []


def _handle_gate_metric(raw: dict) -> tuple[list[str], list[str]]:
    missing = _missing_fields(raw, ["gate_id", "queue_length"])
    if missing:
        return [], missing
    return [make_entity_ref("gate", raw["gate_id"])], []


def _handle_weather_event(raw: dict) -> tuple[list[str], list[str]]:
    missing = _missing_fields(raw, ["area_id", "condition"])
    if missing:
        return [], missing
    return [make_entity_ref("area", raw["area_id"])], []


def _handle_dg_exception(raw: dict) -> tuple[list[str], list[str]]:
    missing = _missing_fields(raw, ["container_id", "vessel_id", "exception_type"])
    if missing:
        return [], missing
    return [make_entity_ref("container", raw["container_id"])], []


def _handle_operator_request(raw: dict) -> tuple[list[str], list[str]]:
    missing = _missing_fields(raw, ["entity_type", "entity_id", "request_type"])
    if missing:
        return [], missing
    if raw["entity_type"] not in _VALID_ENTITY_TYPES:
        # An unrecognized entity_type would otherwise silently produce a
        # malformed-looking entity_ref that violates the fixed 'type:id'
        # convention relied on for cross-signal correlation. Treat it as a
        # missing/invalid required field so it is rejected, not accepted.
        return [], ["entity_type"]
    return [make_entity_ref(raw["entity_type"], raw["entity_id"])], []


_HANDLERS: dict[str, Callable[[dict], tuple[list[str], list[str]]]] = {
    "vessel_eta": _handle_vessel_eta,
    "crane_alert": _handle_crane_alert,
    "yard_metric": _handle_yard_metric,
    "gate_metric": _handle_gate_metric,
    "weather_event": _handle_weather_event,
    "dg_exception": _handle_dg_exception,
    "operator_request": _handle_operator_request,
}


def normalize_signal(raw: dict) -> Signal | RejectedSignal:
    """Normalize a raw signal dict into a `Signal`, or reject it with a logged reason.

    Never raises an unhandled exception to the caller - any unexpected error
    during normalization is caught and returned as a `RejectedSignal`.
    """
    received_at = _utc_now_iso()

    try:
        if not isinstance(raw, dict):
            return RejectedSignal(
                raw={},
                reason=f"raw signal must be a dict, got {type(raw).__name__}",
                received_at=received_at,
            )

        signal_type = raw.get("type")
        handler = _HANDLERS.get(signal_type) if isinstance(signal_type, str) else None

        if handler is None:
            return RejectedSignal(
                raw=raw,
                reason=f"unrecognized signal type: {signal_type!r}",
                received_at=received_at,
            )

        entity_refs, missing = handler(raw)
        if missing:
            return RejectedSignal(
                raw=raw,
                reason=f"missing required field(s) for signal type {signal_type!r}: {', '.join(missing)}",
                received_at=received_at,
            )

        return Signal(
            entity_refs=entity_refs,
            signal_type=signal_type,
            payload=raw,
            received_at=received_at,
        )
    except Exception as exc:  # noqa: BLE001 - normalization must never raise to the caller
        return RejectedSignal(
            raw=raw if isinstance(raw, dict) else {},
            reason=f"unexpected error during normalization: {exc}",
            received_at=received_at,
        )
