"""Signal data model.

`Signal` is the fixed common representation that every downstream Portwatch
stage (correlation, specialist agents, policy) is built against. `RejectedSignal`
is the structured result returned when a raw signal cannot be normalized -
malformed/unrecognized input must never crash the caller or be silently dropped.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class Signal(BaseModel):
    """A normalized signal: one common shape for all 7 supported raw signal types."""

    entity_refs: list[str] = Field(
        ...,
        description="Entity identifiers in the fixed 'type:id' format, e.g. 'vessel:MSC-ANNA', 'berth:C7-3'.",
    )
    signal_type: str = Field(..., description="The recognized raw signal-type identifier, e.g. 'vessel_eta'.")
    payload: dict = Field(..., description="The original raw signal dict, preserved for downstream consumers.")
    received_at: str = Field(..., description="ISO 8601 UTC timestamp of normalization.")


class RejectedSignal(BaseModel):
    """The structured result returned when a raw signal is rejected (never an unhandled exception)."""

    raw: dict = Field(..., description="The original raw signal dict (or {} if it was not even a dict).")
    reason: str = Field(..., description="Logged, human-readable reason the signal was rejected.")
    received_at: str = Field(..., description="ISO 8601 UTC timestamp of the rejection.")
