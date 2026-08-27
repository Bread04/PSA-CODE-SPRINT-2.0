"""Recovery-option data models (Story 1.4).

`RecoveryOption` and its nested `PredictedImpact` are the epic-1-context shared
shape, verbatim: the arbiter (Story 1.4) produces a ranked list of them, the
confidence scorer (Story 1.6) reads the impact spread, the policy engine
(Story 1.7) classifies the selected one, and the DG gate (Story 1.9) inspects
`dg_involved`. This module defines the shape only and imports nothing from
`models.incident`, so `Incident.options` can be retyped to
`list[RecoveryOption]` without a circular import.

`option_id` is a plain `str` here because our code - never the model - stamps
it (`opt-1`, `opt-2`, ...) in ranked order; the field carries no validation
beyond being present.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

LowMedHigh = Literal["low", "medium", "high"]


class PredictedImpact(BaseModel):
    """The forecast consequence of taking a recovery option - one per `RecoveryOption`."""

    # Untrusted model output: reject any field the shared shape does not name.
    model_config = ConfigDict(extra="forbid")

    delay_min: int = Field(
        ...,
        ge=0,
        le=100_000,
        description="Predicted incremental delay in minutes (0 to 100000).",
    )
    cost: LowMedHigh = Field(..., description="Relative cost band: 'low' | 'medium' | 'high'.")
    yard_impact: str = Field(
        ...,
        min_length=1,
        max_length=500,
        description="Free-text description of the effect on yard operations.",
    )
    risk: LowMedHigh = Field(..., description="Relative safety/operational risk band: 'low' | 'medium' | 'high'.")


class RecoveryOption(BaseModel):
    """One ranked recovery choice the arbiter offers - the epic-1-context shared shape exactly."""

    # Untrusted model output: reject any field the shared shape does not name.
    model_config = ConfigDict(extra="forbid")

    option_id: str = Field(
        ...,
        description="Stable id stamped by our code in ranked order ('opt-1', 'opt-2', ...); never read from the model.",
    )
    description: str = Field(
        ...,
        min_length=1,
        description="What this option does, in operator-facing terms.",
    )
    predicted_impact: PredictedImpact = Field(..., description="Forecast consequence of taking this option.")
    reversible: bool = Field(..., description="Whether the action can be cleanly undone.")
    dg_involved: bool = Field(..., description="Whether dangerous-goods / IMDG cargo is affected (Story 1.9 gate).")
