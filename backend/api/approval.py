"""The one write path from the console to an incident (AD-11).

`apply_approval` maps the three-verb approval contract
(`approve` | `reject` | `select_alternative`) onto the orchestrator's
`approve_incident`. `select_alternative` picks a different *pre-computed*
option by id and then approves — never a free-form plan edit.
"""

from __future__ import annotations

from typing import Any, Literal

from models.incident import Incident
from orchestrator.run import approve_incident
from orchestrator.trace import append_trace

ApprovalAction = Literal["approve", "reject", "select_alternative"]


class ApprovalError(ValueError):
    """A malformed or non-applicable approval request (surfaced as HTTP 4xx)."""


async def apply_approval(
    incident: Incident,
    action: ApprovalAction,
    option_id: str | None = None,
) -> dict[str, Any]:
    """Apply an operator decision to `incident` (mutated in place)."""
    if action == "approve":
        return await approve_incident(incident)

    if action == "select_alternative":
        if not option_id or not option_id.strip():
            raise ApprovalError("select_alternative requires a non-empty option_id")
        if not any(opt.option_id == option_id for opt in incident.options):
            raise ApprovalError(f"unknown option_id {option_id!r} for this incident")
        incident.recommended_option_id = option_id
        append_trace(incident, "APPROVAL", {"action": "select_alternative", "option_id": option_id})
        return await approve_incident(incident)

    if action == "reject":
        incident.approval_status = "rejected"
        incident.status = "resolved"
        append_trace(incident, "APPROVAL", {"action": "reject", "operator": True})
        return {"approved": False, "rejected": True}

    raise ApprovalError(f"unknown approval action {action!r}")
