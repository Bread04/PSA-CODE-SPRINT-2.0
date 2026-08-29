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

import asyncio
import os
from contextlib import asynccontextmanager
from typing import Literal

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from api import demo_driver
from api.approval import ApprovalError, apply_approval
from api.demo_seed import seed_demo
from api.query import answer_query
from api.state import get_incident, list_incidents, reset_state
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


class DemoTriggerResponse(BaseModel):
    started: bool
    primary_incident_id: str | None


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


# Module global: keeps the fire-and-forget demo driver task from being garbage
# collected mid-run (asyncio holds only a weak reference to bare tasks).
_demo_task: asyncio.Task[None] | None = None


@app.post("/demo/three-way-disruption", response_model=DemoTriggerResponse)
async def post_demo_trigger() -> DemoTriggerResponse:
    """Dev-only: clear incident state and launch the live "Three-Way Disruption" run.

    Gated by `PORTWATCH_DEMO_TRIGGER` (default `"1"`, on — like `demo_seed.py`'s
    `PORTWATCH_SEED`): a prod deploy sets it to `"0"` and the route 404s.

    One run at a time — a second POST while a driver task is running returns 409
    and resets nothing. Strictly additive: this is the only `/demo/*` write path
    and it drives the real specialist -> arbiter -> policy chain (spec-demo-
    three-way-disruption-trigger).
    """
    global _demo_task
    if os.environ.get("PORTWATCH_DEMO_TRIGGER", "1") == "0":
        raise HTTPException(status_code=404, detail="demo trigger disabled")

    if demo_driver.is_demo_run_active():
        raise HTTPException(status_code=409, detail="a demo run is already in progress")

    demo_driver.mark_demo_run_active(True)
    try:
        reset_state()
        primary = demo_driver.create_primary_incident()
        _demo_task = asyncio.create_task(demo_driver.run_three_way_disruption_demo(primary))
    except Exception:
        demo_driver.mark_demo_run_active(False)
        raise

    return DemoTriggerResponse(started=True, primary_incident_id=primary.incident_id)


@app.post("/kill-switch", response_model=KillSwitchResponse)
async def post_kill_switch(body: KillSwitchRequest) -> KillSwitchResponse:
    if body.enabled:
        engage_kill_switch()
    else:
        disengage_kill_switch()
    return KillSwitchResponse(enabled=is_kill_switch_engaged())
