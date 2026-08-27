"""Story 1.6: Deterministic confidence scoring.

Confidence is a pure function of incident data quality - never an LLM's
self-assessment (FR6). Every penalty is mechanical; the score is unit-testable
with no live API call. See epics.md Story 1.6 for the penalty matrix.

The same -15pt missing-data penalty Story 1.6 applies to a fallback/cached
state field is also applied to a mock-forced agent call (Story 1.13), so a
canned response is never treated as equivalent to real data: `mock_forced`
simply adds one fallback field to the count.
"""

from __future__ import annotations

from dataclasses import dataclass

BASE_CONFIDENCE = 100

# Telemetry older than this is "stale"; staleness is measured from here.
FRESHNESS_THRESHOLD_SECONDS = 60
# 1pt per 10s of staleness beyond fresh, capped at -20 (Story 1.6).
STALENESS_PENALTY_PER_10S = 1
MAX_STALENESS_PENALTY = 20
# Per required field served from fallback/cached state (or a mock-forced call).
FALLBACK_FIELD_PENALTY = 15
# Flat disagreement penalty, once, not per conflicting pair (Story 1.4 / 1.6).
DISAGREEMENT_PENALTY = 10
# Flat penalty when predicted-outcome spread exceeds 30% (Story 1.6).
VARIANCE_PENALTY = 10


@dataclass
class ConfidencePenalties:
    """The mechanical inputs to the confidence score; all optional, all additive."""

    staleness_seconds: int = 0
    fallback_field_count: int = 0
    disagreement: bool = False
    variance_exceeds: bool = False

    @classmethod
    def from_inputs(
        cls,
        *,
        staleness_seconds: int = 0,
        fallback_fields: int = 0,
        mock_forced: bool = False,
        disagreement: bool = False,
        variance_exceeds: bool = False,
    ) -> "ConfidencePenalties":
        # A mock-forced call counts as one missing-data / fallback field (Story 1.13).
        return cls(
            staleness_seconds=staleness_seconds,
            fallback_field_count=fallback_fields + (1 if mock_forced else 0),
            disagreement=disagreement,
            variance_exceeds=variance_exceeds,
        )


def compute_confidence(penalties: ConfidencePenalties) -> int:
    """Deterministic 0-100 score: 100 minus the sum of applicable penalties."""
    score = BASE_CONFIDENCE

    stale = max(0, penalties.staleness_seconds - FRESHNESS_THRESHOLD_SECONDS)
    score -= min(MAX_STALENESS_PENALTY, (stale // 10) * STALENESS_PENALTY_PER_10S)

    score -= penalties.fallback_field_count * FALLBACK_FIELD_PENALTY

    if penalties.disagreement:
        score -= DISAGREEMENT_PENALTY
    if penalties.variance_exceeds:
        score -= VARIANCE_PENALTY

    return max(0, min(100, score))
