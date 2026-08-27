"""Story 1.7: Policy tier classification - deterministic, outside LLM authority (FR7).

Given a recovery option and its computed confidence, classify it into Tier 1/2/3
by fixed, auditable rules. The function is pure: the same inputs always return
the same tier, and no model call sits in its decision path.

The shared `RecoveryOption` shape carries no dedicated SLA-breach field, so an
SLA breach is derived from predicted delay beyond `SLA_DELAY_THRESHOLD_MIN`
(Story 1.7: "no SLA breach"). The rule set:

  Tier 1: reversible, no SLA breach, risk == low, confidence >= 85, cost == low,
          no DG involvement.
  Tier 2: reversible, no SLA breach, risk in {low, medium}, confidence >= 70,
          cost in {low, medium}, no DG involvement, but not Tier 1.
  Tier 3: anything failing a Tier 1/2 condition (irreversible, SLA breach,
          high risk, confidence below Tier 2 floor, high cost, or DG involvement).
"""

from __future__ import annotations

from typing import Literal

from models.recovery import RecoveryOption

# Predicted delay (minutes) beyond which a recovery option breaches the terminal SLA.
SLA_DELAY_THRESHOLD_MIN = 120


def sla_breached(option: RecoveryOption) -> bool:
    """An SLA breach is derived from the predicted delay (Story 1.7)."""
    return option.predicted_impact.delay_min > SLA_DELAY_THRESHOLD_MIN


def classify_tier(option: RecoveryOption, confidence: int) -> Literal[1, 2, 3]:
    """Return the deterministic policy tier for `option` at `confidence`."""
    if option.dg_involved or sla_breached(option):
        return 3

    risk = option.predicted_impact.risk
    cost = option.predicted_impact.cost

    if (
        option.reversible
        and risk == "low"
        and confidence >= 85
        and cost == "low"
    ):
        return 1

    if (
        option.reversible
        and risk in ("low", "medium")
        and confidence >= 70
        and cost in ("low", "medium")
    ):
        return 2

    return 3
