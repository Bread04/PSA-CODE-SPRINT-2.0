"""FastAPI application — the console's HTTP surface (ARCHITECTURE-SPINE.md 225-231).

Endpoints (all JSON):
    GET  /incidents                       -> Incident[]
    GET  /incidents/{id}                   -> Incident        (404 if unknown)
    POST /incidents/{id}/approval          -> Incident        (body: ApprovalRequest)
    GET  /incidents/query?q=&incident_id=  -> {"answer": str} (FR12)
    POST /kill-switch                      -> {"enabled": bool}
    GET  /healthz                          -> {"ok": true}

No new domain logic: each route is a thin adapter over the registry, the
orchestrator's `approve_incident`, and `policy.killswitch`.
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import Literal

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from api.approval import ApprovalError, apply_approval
from api.demo_seed import seed_demo
from api.query import answer_query
from api.state import get_incident, list_incidents
from models.incident import Incident
from policy.killswitch import disengage_kill_switch, engage_kill_switch, is_kill_switch_engaged


class ApprovalRequest(BaseModel):
    """AD-11: exactly one of three verbs; `option_id` only with `select_alternative`."""

    action: Literal["approve", "reject", "select_alternative"]
    option_id: str | None = None


class KillSwitchRequest(BaseModel):
    enabled: bool = Field(..., description="Engage (true) or disengage (false) the global kill switch.")


class QueryResponse(BaseModel):
    answer: str


class KillSwitchResponse(BaseModel):
    enabled: bool


@asynccontextmanager
async def _lifespan(_app: FastAPI):
    added = seed_demo()
    if added:
        print(f"[portwatch-api] seeded {added} demo incident(s)")
    yield


app = FastAPI(title="Portwatch Console API", version="1.0.0", lifespan=_lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/healthz")
async def healthz() -> dict[str, bool]:
    return {"ok": True}


@app.get("/incidents", response_model=list[Incident])
async def get_incidents() -> list[Incident]:
    return list_incidents()


@app.get("/incidents/query", response_model=QueryResponse)
async def get_query(q: str = "", incident_id: str | None = None) -> QueryResponse:
    return QueryResponse(answer=answer_query(q, list_incidents(), incident_id))


@app.get("/incidents/{incident_id}", response_model=Incident)
async def get_one_incident(incident_id: str) -> Incident:
    inc = get_incident(incident_id)
    if inc is None:
        raise HTTPException(status_code=404, detail=f"unknown incident {incident_id!r}")
    return inc


@app.post("/incidents/{incident_id}/approval", response_model=Incident)
async def post_approval(incident_id: str, body: ApprovalRequest) -> Incident:
    inc = get_incident(incident_id)
    if inc is None:
        raise HTTPException(status_code=404, detail=f"unknown incident {incident_id!r}")
    try:
        await apply_approval(inc, body.action, body.option_id)
    except ApprovalError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return inc


@app.post("/kill-switch", response_model=KillSwitchResponse)
async def post_kill_switch(body: KillSwitchRequest) -> KillSwitchResponse:
    if body.enabled:
        engage_kill_switch()
    else:
        disengage_kill_switch()
    return KillSwitchResponse(enabled=is_kill_switch_engaged())
