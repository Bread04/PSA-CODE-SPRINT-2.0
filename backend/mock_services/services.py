"""Story 1.11: Mock service execution & verification (FR13, NFR2).

Every approved/auto action is executed against mock services using the shared
`async def execute(action: dict) -> {ok, result, error}` contract. The seven
port services are TOS, Crane Scheduler, Yard Manager, AGV Manager, Gate Manager,
Notification (incl. MPA), and DG Checker.

Each call in an action is verified and recorded individually - a failure is
never silently treated as success, and a multi-call action is not rolled up
into one pass/fail.
"""

from __future__ import annotations

from typing import Any


class MockService:
    """A mock port service honouring the shared `execute` contract (Story 1.11)."""

    def __init__(self, name: str, *, fail: bool = False) -> None:
        self.name = name
        self._fail = fail

    async def execute(self, action: dict) -> dict:
        if self._fail:
            return {"ok": False, "result": None, "error": f"{self.name}: simulated failure"}
        return {"ok": True, "result": {"service": self.name, "accepted": action}, "error": None}


# The seven mock port services named in Story 1.11.
SERVICE_NAMES = (
    "tos",
    "crane_scheduler",
    "yard_manager",
    "agv_manager",
    "gate_manager",
    "notification",
    "dg_checker",
)


def build_registry(*, failing: set[str] | None = None) -> dict[str, MockService]:
    """Build the mock-service registry; name any service in `failing` to force it to fail."""
    failing = failing or set()
    return {name: MockService(name, fail=(name in failing)) for name in SERVICE_NAMES}


async def execute_action(action: dict, registry: dict[str, MockService]) -> list[dict]:
    """Execute every call in `action['calls']` against the registry, recording each individually.

    Returns a list of per-call result dicts `{service, ok, result, error}`. An
    unknown service or a raised exception is recorded as a failure, never swallowed.
    """
    results: list[dict] = []
    for call in action.get("calls", []) or []:
        svc_name = call.get("service")
        service = registry.get(svc_name)
        if service is None:
            results.append(
                {"service": svc_name, "ok": False, "result": None, "error": f"unknown mock service: {svc_name!r}"}
            )
            continue
        try:
            outcome = await service.execute(call.get("payload", {}))
        except Exception as exc:  # noqa: BLE001 - record, never silently succeed
            outcome = {"ok": False, "result": None, "error": f"{svc_name}: raised {type(exc).__name__}: {exc}"}
        results.append({"service": svc_name, **outcome})
    return results
