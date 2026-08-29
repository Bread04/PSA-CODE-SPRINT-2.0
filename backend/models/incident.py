"""Incident and trace-entry data models.

`Incident` is the single mutable record that one orchestrator task owns per
real-world disruption (AD-4): correlation (Story 1.2) creates it, and every
later Portwatch stage - specialist agents, arbiter, confidence, policy, DG
gate, execution - attaches its output to that same object and appends to its
`trace`. This module only defines the shape. The `IncidentRegistry` is the
sole creator of `Incident`s; the orchestrator is the sole writer thereafter.

Fields beyond correlation bookkeeping (`tier`, `confidence`, `options`, ...)
are carried here verbatim from the epic-1 shared shape so downstream stories
populate them in place rather than redefining the record. They default to
null / empty - `confidence` to `100`, the pre-penalty starting score
(Story 1.6) - until the stage that owns them runs.
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

from models.recovery import RecoveryOption


class TraceEntry(BaseModel):
    """One append-only step in an incident's execution trace.

    `stage` is SCREAMING_SNAKE (`CORRELATE`, `AGENT_CALL`, ...); `timestamp`
    is an ISO 8601 UTC string; `error` carries the fixed failure shape
    `{stage, error, retried, fallback_used}` or is `None` when the step
    succeeded.
    """

    stage: str = Field(..., description="SCREAMING_SNAKE stage name, e.g. 'CORRELATE'.")
    timestamp: str = Field(..., description="ISO 8601 UTC timestamp of the trace step.")
    detail: dict[str, Any] = Field(default_factory=dict, description="Stage-specific structured context.")
    error: dict | None = Field(
        default=None,
        description="Fixed failure shape {stage, error, retried, fallback_used}, or None when the step succeeded.",
    )


class Incident(BaseModel):
    """The mutable per-disruption record: created by `IncidentRegistry`, written only by the orchestrator."""

    incident_id: str = Field(..., description="UUID4 string, assigned at creation.")
    status: Literal["open", "resolved"] = Field(
        default="open",
        description="'open' | 'resolved'. Story 1.2 only ever creates 'open'.",
    )
    entity_refs: list[str] = Field(
        default_factory=list,
        description="Union of every correlated signal's entity refs, in first-seen order.",
    )
    tier: Literal[1, 2, 3] | None = Field(
        default=None,
        description="Policy tier 1|2|3, or None before classification (Story 1.7).",
    )
    confidence: int = Field(
        default=100,
        ge=0,
        le=100,
        description="Deterministic score 0-100; starts at 100 before penalties (Story 1.6).",
    )
    recommended_option_id: str | None = Field(
        default=None,
        description="Arbiter's chosen recovery-option id (Story 1.4), or None.",
    )
    options: list[RecoveryOption] = Field(
        default_factory=list, description="Ranked RecoveryOptions, best first (Story 1.4)."
    )
    approval_status: Literal["n/a", "pending", "approved", "rejected"] = Field(
        default="n/a",
        description="'n/a' | 'pending' | 'approved' | 'rejected'.",
    )
    blocked_by_kill_switch: bool = Field(
        default=False,
        description="Set by Story 1.10 when the kill switch blocks a Tier 1/2 execution.",
    )
    agents: list[dict[str, Any]] = Field(
        default_factory=list,
        description=(
            "Specialist bundle exposed read-only for the agent roster (AD-19); [] until AGENT_CALL runs. "
            "Entry shape = SpecialistRecommendation."
        ),
    )
    trace: list[TraceEntry] = Field(default_factory=list, description="Append-only execution trace.")

    # --- Correlation bookkeeping (owned by IncidentRegistry, Story 1.2) ---
    created_at: str = Field(..., description="ISO 8601 UTC time of the signal that created this incident.")
    last_signal_at: str = Field(
        ...,
        description="ISO 8601 UTC time of the most recent correlated signal; the 15-minute window is measured from here.",
    )
