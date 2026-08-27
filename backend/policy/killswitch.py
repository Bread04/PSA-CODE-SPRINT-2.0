"""Story 1.10: Global kill switch (FR10, AD-7, AD-15).

A single boolean that immediately disables all autonomous execution. It is
checked at exactly ONE point in the pipeline - immediately before mock-service
execution (AD-7) - never at ingestion, correlation, or analysis.

Engaging it never reclassifies a decision to Tier 3 (AD-15); it only blocks
execution and marks `Incident.blocked_by_kill_switch`. The operator's existing
Approve action re-checks the flag, so disengaging and approving proceeds if the
switch is now clear - no new endpoint is introduced.
"""

from __future__ import annotations

_KILL_SWITCH_ENGAGED = False


def engage_kill_switch() -> None:
    """Engage the global kill switch: block all autonomous execution."""
    global _KILL_SWITCH_ENGAGED
    _KILL_SWITCH_ENGAGED = True


def disengage_kill_switch() -> None:
    """Disengage the global kill switch: allow execution to proceed again."""
    global _KILL_SWITCH_ENGAGED
    _KILL_SWITCH_ENGAGED = False


def is_kill_switch_engaged() -> bool:
    """The one kill-switch read point used across the pipeline (AD-7)."""
    return _KILL_SWITCH_ENGAGED


def reset_kill_switch_for_tests() -> None:
    """Test helper: return the switch to its default (disengaged) state."""
    global _KILL_SWITCH_ENGAGED
    _KILL_SWITCH_ENGAGED = False
