"""Story 1.12: Execution trace recording (FR14, AD-4, AD-14, NFR1).

Every incident produces a structured, timestamped execution trace covering the
full pipeline. Only the owning orchestrator task appends to a given incident's
trace (AD-4) - entries are append-only, never rewritten or reordered. Each entry
has a SCREAMING_SNAKE `stage`, an ISO 8601 UTC `timestamp`, and stage-specific
`detail`; on a stage failure/retry/fallback the fixed error shape
`{stage, error, retried, fallback_used}` is populated, never omitted.
"""

from __future__ import annotations

from datetime import datetime, timezone

from models.incident import Incident, TraceEntry

# The canonical pipeline stages, in order (Story 1.12). `POLICY_START` and
# `NOTIFY` are the internal bookkeeping stages the orchestrator also emits
# (epic-1 retro action item 1); the frontend ExecutionTrace renders any stage,
# known or not, so this list stays the authoritative producer-side vocabulary.
STAGES = (
    "INGEST",
    "CORRELATE",
    "AGENT_CALL",
    "SYNTHESIZE",
    "CONFIDENCE",
    "POLICY_START",
    "POLICY_DECISION",
    "DG_CHECK",
    "APPROVAL",
    "EXECUTE",
    "NOTIFY",
    "VERIFY",
)


def now_utc() -> str:
    """Current time as an ISO 8601 UTC string (Story 1.12)."""
    return datetime.now(timezone.utc).isoformat()


def error_shape(stage: str, err: object, *, retried: bool = False, fallback_used: bool = False) -> dict:
    """The fixed Consistency-Conventions failure shape (Story 1.12)."""
    return {
        "stage": stage,
        "error": str(err),
        "retried": retried,
        "fallback_used": fallback_used,
    }


def append_trace(
    incident: Incident,
    stage: str,
    detail: dict | None = None,
    *,
    error: dict | None = None,
) -> TraceEntry:
    """Append one trace entry to `incident` (the only writer, AD-4). Returns it."""
    entry = TraceEntry(stage=stage, timestamp=now_utc(), detail=detail or {}, error=error)
    incident.trace.append(entry)
    return entry
