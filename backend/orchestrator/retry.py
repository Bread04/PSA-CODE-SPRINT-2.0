"""Story 1.5: Tool retry then fallback on failure (FR5, AD-13, NFR3).

Exactly one retry is attempted with a short fixed timeout (AD-13) - never the
client's default timeout - then, if the retry also fails, the call falls back
to the entity's last-known cached state. If no last-known state exists (a
first-ever call for that entity) a defined neutral `empty_state` is used instead
of crashing.

The result carries `retried` and `fallback_used` so the trace (Story 1.12) and
confidence scorer (Story 1.6) can distinguish success-after-retry
(`retried=True, fallback_used=False`) from fallback-after-exhausted-retry
(`fallback_used=True`) - and so a missing-data case is flagged for the maximum
confidence penalty.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Any, Awaitable, Callable

# AD-13: a short fixed timeout for the (single) retry, not the client default.
RETRY_FIXED_TIMEOUT_SECONDS = 5


@dataclass
class RetryResult:
    """Outcome of `with_retry`."""

    ok: bool
    retried: bool
    fallback_used: bool
    value: Any
    error: str | None


async def with_retry(
    call: Callable[[], Awaitable[Any]],
    *,
    fallback: Callable[[], Any] | None = None,
    empty_state: Any | None = None,
    timeout: float = RETRY_FIXED_TIMEOUT_SECONDS,
) -> RetryResult:
    """Attempt `call` once; on failure retry exactly once (fixed short timeout).

    If the retry also fails, fall back to `fallback()` (last-known cached state)
    when provided, else to `empty_state`. Never raises on a tool failure: the
    incident degrades gracefully rather than crashing.
    """

    async def _attempt() -> Any:
        return await asyncio.wait_for(call(), timeout=timeout)

    last_err: Exception | None = None

    try:
        return RetryResult(ok=True, retried=False, fallback_used=False, value=await _attempt(), error=None)
    except Exception as first_err:  # first attempt failed -> exactly one retry
        last_err = first_err

    try:
        return RetryResult(ok=True, retried=True, fallback_used=False, value=await _attempt(), error=str(last_err))
    except Exception as second_err:
        last_err = second_err

    # Retry exhausted: fall back to last-known state, else neutral empty state.
    if fallback is not None:
        try:
            value = fallback()
        except Exception:
            value = empty_state
        return RetryResult(ok=False, retried=True, fallback_used=True, value=value, error=str(last_err))
    return RetryResult(ok=False, retried=True, fallback_used=True, value=empty_state, error=str(last_err))
