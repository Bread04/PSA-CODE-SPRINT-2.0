"""Story 1.9: DG/IMDG hard gate (FR9, AD-8).

A recovery option that touches dangerous goods (IMDG cargo) is a hard violation
that may never execute at any tier, even after a tier-approved recommendation.
The bounded re-plan loop (2 re-attempts, AD-8) is driven by the orchestrator
(`orchestrator.run`); this module owns the pure check and the rejection-reason
shape, plus a helper the orchestrator uses to record the rejection.
"""

from __future__ import annotations

from models.recovery import RecoveryOption

# AD-8: a DG conflict may loop back at most twice before forced Tier 3 escalation.
MAX_DG_REPLAN_ATTEMPTS = 2


def dg_violation(option: RecoveryOption) -> bool:
    """True when the option affects dangerous goods / IMDG cargo (Story 1.9)."""
    return option.dg_involved


def dg_rejection_reason(option: RecoveryOption) -> str:
    """Human-readable, auditable reason a DG-gated option was rejected."""
    return (
        f"DG/IMDG segregation violation: option '{option.option_id}' affects "
        f"dangerous goods and cannot be auto-executed at any tier."
    )
