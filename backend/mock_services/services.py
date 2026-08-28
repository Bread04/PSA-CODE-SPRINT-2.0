"""Story 1.11: Mock service execution & verification (FR13, NFR2).

Every approved/auto action is executed against mock services using the shared
`async def execute(action: dict) -> {ok, result, error}` contract. The roster is
now eight port services: TOS, Crane Scheduler, Yard Manager, AGV Manager, Gate
Manager, Notification, DG Checker, and MPA Clearance. MPA clearance is its own
deterministic service (spec-3-4) modelling the digitalPORT@SG request -> status
-> conditions shape - it is no longer folded in as a note on the generic
`notification` mock. It makes no live call to digitalPORT@SG or any real MPA
system, ever.

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


# The spec-3-4 clearance-check service name, referenced in several places.
MPA_CLEARANCE = "mpa_clearance"

# The mock port services in the roster. The first seven are Story 1.11; the
# eighth, `mpa_clearance`, is the spec-3-4 clearance-check service.
SERVICE_NAMES = (
    "tos",
    "crane_scheduler",
    "yard_manager",
    "agv_manager",
    "gate_manager",
    "notification",
    "dg_checker",
    MPA_CLEARANCE,
)

# Payload keys that flag hazmat / dangerous-goods cargo on a clearance request.
_MPA_CONDITIONAL_FLAGS = ("hazmat", "dg", "dg_involved", "imdg", "dangerous_goods")

# Fixed, deterministic condition strings returned for the non-granted outcomes.
# Kept as tuples; `_mpa_conditions_for` returns a fresh list per call.
_MPA_CONDITIONAL_CONDITIONS = (
    "submit_imdg_declaration",
    "escort_tug_required",
)
_MPA_REFUSED_CONDITIONS = (
    "clearance_denied_resubmit_corrected_manifest",
)


def _mpa_payload(action: object) -> dict:
    """Coerce whatever `execute` was handed into a dict; a non-dict yields `{}`."""
    return action if isinstance(action, dict) else {}


def _mpa_status_for(action: object) -> str:
    """Pure map from a clearance-request payload to one of the three MPA statuses.

    `"refused"` when a truthy `deny` flag is set; `"conditional"` when a truthy
    hazmat / dangerous-goods flag is present; `"granted"` otherwise. Only
    genuinely truthy values trigger - `False` / `0` / `""` do not. No randomness,
    no wall-clock, no I/O; tolerant of a non-dict `action`.
    """
    payload = _mpa_payload(action)
    if payload.get("deny"):
        return "refused"
    if any(payload.get(flag) for flag in _MPA_CONDITIONAL_FLAGS):
        return "conditional"
    return "granted"


def _mpa_conditions_for(action: object) -> list[str]:
    """Fresh non-empty condition list for `conditional` / `refused`, `[]` for `granted`."""
    status = _mpa_status_for(action)
    if status == "conditional":
        return list(_MPA_CONDITIONAL_CONDITIONS)
    if status == "refused":
        return list(_MPA_REFUSED_CONDITIONS)
    return []


def _mpa_request_ref(action: object) -> str:
    """Echo the caller's clearance reference by presence, else a fixed placeholder.

    A present-but-falsy `clearance_ref` (`""`, `0`, `False`) is still echoed -
    presence, not truthiness, decides which key wins.
    """
    payload = _mpa_payload(action)
    if "clearance_ref" in payload:
        return str(payload["clearance_ref"])
    if "request_ref" in payload:
        return str(payload["request_ref"])
    return "MPA-REQ"


class MpaClearanceService(MockService):
    """Deterministic MPA-style clearance check (spec-3-4).

    Models the digitalPORT@SG request -> status -> conditions shape. Honours the
    shared `execute(action) -> {ok, result, error}` contract exactly, including
    the injectable failure mode inherited from `MockService`. On success the
    `result` is `{service, clearance_status, conditions, request_ref}`, derived
    purely from the call payload (tolerant of a non-dict payload). Never makes a
    live call.
    """

    async def execute(self, action: dict) -> dict:
        if self._fail:
            return await super().execute(action)
        payload = _mpa_payload(action)
        return {
            "ok": True,
            "result": {
                "service": self.name,
                "clearance_status": _mpa_status_for(payload),
                "conditions": _mpa_conditions_for(payload),
                "request_ref": _mpa_request_ref(payload),
            },
            "error": None,
        }


# Roster names whose registry entry is a specialised subclass rather than the
# plain `MockService`.
_SPECIAL_SERVICES: dict[str, type[MockService]] = {MPA_CLEARANCE: MpaClearanceService}


def build_registry(*, failing: set[str] | None = None) -> dict[str, MockService]:
    """Build the mock-service registry; name any service in `failing` to force it to fail."""
    failing = failing or set()
    reg: dict[str, MockService] = {}
    for name in SERVICE_NAMES:
        cls = _SPECIAL_SERVICES.get(name, MockService)
        reg[name] = cls(name, fail=(name in failing))
    return reg


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
