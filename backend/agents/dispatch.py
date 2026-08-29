"""Concurrent specialist dispatch (Story 1.3 / AD-13).

`run_specialists()` is the whole orchestrator surface this story adds: given
one `Incident` it renders the incident brief ONCE (`_incident_summary`, so no
mutable `Incident` reference ever reaches a specialist - AD-4) and fans out
the three `call_specialist()` coroutines onto a single shared client with one
`asyncio.gather`, so the three bounded calls overlap (NFR1's ~20-30s
golden-path budget assumes concurrency, not a sequential chain).

Failure handling is deterministic and leak-free: `gather(return_exceptions=
True)` lets every coroutine finish (nothing is left un-awaited, no "task
exception never retrieved"), then the first failure in berth -> crane -> yard
order is re-raised as a `SpecialistError` with the other failures attached as
a note. A captured `CancelledError` is re-raised as-is, never wrapped. Retry,
timeout tuning, and fallback-to-last-known-state are Story 1.5's contract.
"""

from __future__ import annotations

import asyncio
import inspect
from typing import Any

from models.incident import Incident

from agents.arbiter import ArbiterResult
from agents.arbiter import synthesize_options as _arbiter_synthesize
from agents.base import (
    AgentName,
    SpecialistBundle,
    SpecialistError,
    _incident_summary,
    call_specialist,
)

# Fixed bundle order; also the tie-break order for a multi-agent failure.
_AGENT_ORDER: tuple[AgentName, AgentName, AgentName] = ("berth", "crane", "yard")


async def _maybe_close(client: Any) -> None:
    """Best-effort close of a client this module constructed itself."""
    for attr in ("aclose", "close"):
        closer = getattr(client, attr, None)
        if closer is None:
            continue
        try:
            result = closer()
            if inspect.isawaitable(result):
                await result
        except Exception:  # noqa: BLE001 - teardown must not mask the real outcome
            pass
        return


async def run_specialists(incident: Incident, *, client: Any | None = None) -> SpecialistBundle:
    """Run the berth, crane, and yard specialists concurrently on one incident.

    `client` is injected in tests (an object exposing an async
    `messages.create`). When omitted, one `AsyncAnthropic()` is built here and
    a constructor failure is wrapped as `SpecialistError("dispatch", ...)`.
    """
    owns_client = client is None
    if owns_client:
        try:
            from anthropic import AsyncAnthropic

            client = AsyncAnthropic()
        except Exception as exc:  # noqa: BLE001 - no raw construction error may escape
            raise SpecialistError(
                "dispatch",
                f"could not construct AsyncAnthropic client: {type(exc).__name__}: {exc}",
            ) from exc

    brief = _incident_summary(incident)

    try:
        results = await asyncio.gather(
            *(call_specialist(name, brief, client=client) for name in _AGENT_ORDER),
            return_exceptions=True,
        )
    finally:
        if owns_client:
            await _maybe_close(client)

    ordered_failures: list[tuple[str, BaseException]] = []
    for name, result in zip(_AGENT_ORDER, results):
        if isinstance(result, asyncio.CancelledError):
            raise result
        if isinstance(result, BaseException):
            ordered_failures.append((name, result))

    if ordered_failures:
        first_name, first_exc = ordered_failures[0]
        err = (
            first_exc
            if isinstance(first_exc, SpecialistError)
            else SpecialistError(first_name, f"{type(first_exc).__name__}: {first_exc}")
        )
        if len(ordered_failures) > 1:
            others = [
                f"{name}: {exc.reason if isinstance(exc, SpecialistError) else exc}"
                for name, exc in ordered_failures[1:]
            ]
            err.add_note(f"other specialist failures: {others}")
        raise err

    # AD-19 integration point — for the FUTURE caller, not this function.
    # When a live chain (ingestion → specialists → arbiter → policy) exists, the
    # orchestrator that awaits this bundle — still the sole writer (AD-4) — must,
    # before run_policy_and_execution:
    #   incident.agents = [r.model_dump() for r in bundle.recommendations]
    # and append one AGENT_CALL trace entry per recommendation, each with
    # detail {agent, mock_forced} (AD-16) plus the standard
    # {stage, error, retried, fallback_used} shape on a timeout/fallback.
    # No live caller exists today; the demo path populates it in api/demo_seed.py.
    return SpecialistBundle(recommendations=list(results))


async def synthesize_options(
    incident: Incident,
    bundle: SpecialistBundle,
    *,
    client: Any | None = None,
) -> ArbiterResult:
    """Run the arbiter over one incident + its `SpecialistBundle`, returning 1-3 ranked recovery options.

    Mirrors `run_specialists`: the incident brief is rendered ONCE here with
    `_incident_summary` (no mutable `Incident` reference reaches the arbiter -
    AD-4), and `client` is injected in tests. When omitted, one
    `AsyncAnthropic()` is built here, a constructor failure is wrapped as
    `SpecialistError("dispatch", ...)`, and the client is best-effort closed
    afterwards. Any synthesis failure propagates as `SpecialistError("arbiter",
    ...)`; retry/fallback is Story 1.5.
    """
    owns_client = client is None
    if owns_client:
        try:
            from anthropic import AsyncAnthropic

            client = AsyncAnthropic()
        except Exception as exc:  # noqa: BLE001 - no raw construction error may escape
            raise SpecialistError(
                "dispatch",
                f"could not construct AsyncAnthropic client: {type(exc).__name__}: {exc}",
            ) from exc

    brief = _incident_summary(incident)

    try:
        return await _arbiter_synthesize(brief, bundle, client=client)
    finally:
        if owns_client:
            await _maybe_close(client)
