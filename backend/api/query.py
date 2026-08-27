"""FR12 natural-language status query (AD-2).

`answer_query` resolves the relevant incident *from the question text* (an
`incident_id` hint is optional and only breaks ties), then answers grounded in
that incident's live state. It never fabricates a status: an unresolvable
question gets an explicit "no match" answer.

If `ANTHROPIC_API_KEY` is set the phrasing is delegated to a single bounded
Messages API call with the resolved incident state injected as context (AD-2);
otherwise a deterministic template is used so the endpoint works offline and in
CI. The *resolution* and the *facts* are identical either way — only the prose
differs.
"""

from __future__ import annotations

import os
import re

from models.incident import Incident


def _tokens(text: str) -> set[str]:
    return {t for t in re.split(r"[^a-z0-9]+", text.lower()) if len(t) > 1}


def _ref_label(ref: str) -> str:
    """`vessel:MSC-ANNA` -> `msc anna` (lower, for matching)."""
    _, _, tail = ref.partition(":")
    return re.sub(r"[-_]+", " ", (tail or ref)).strip().lower()


def resolve_incident(q: str, incidents: list[Incident], incident_id: str | None) -> Incident | None:
    """The incident a free-text question is about, or None."""
    if incident_id:
        hinted = next((i for i in incidents if i.incident_id == incident_id), None)
        if hinted is not None:
            return hinted

    qtok = _tokens(q)
    if not qtok:
        return None

    scored: list[tuple[int, Incident]] = []
    for inc in incidents:
        score = 0
        for ref in inc.entity_refs:
            label_tokens = _tokens(_ref_label(ref))
            score += 2 * len(label_tokens & qtok)
        for opt in inc.options:
            score += len(_tokens(opt.description) & qtok)
        if score:
            scored.append((score, inc))

    if not scored:
        return None
    scored.sort(key=lambda s: (s[0], s[1].last_signal_at), reverse=True)
    return scored[0][1]


def _facts(inc: Incident) -> str:
    entities = ", ".join(_ref_label(r).title() for r in inc.entity_refs) or "the incident"
    tier = f"Tier {inc.tier}" if inc.tier else "not yet classified"
    approval = {
        "n/a": "auto-handled",
        "pending": "awaiting operator approval",
        "approved": "approved",
        "rejected": "rejected by the operator",
    }.get(inc.approval_status, inc.approval_status)
    rec = next((o for o in inc.options if o.option_id == inc.recommended_option_id), None)
    plan = f" Recommended: {rec.description}." if rec else ""
    ks = " Autonomous execution is currently blocked by the kill switch." if inc.blocked_by_kill_switch else ""
    return (
        f"{entities}: incident {inc.status}, {tier}, confidence {inc.confidence}%, {approval}.{plan}{ks}"
    )


def _llm_answer(q: str, inc: Incident) -> str | None:
    """Try a single bounded Messages API call; return None on any failure."""
    if not os.environ.get("ANTHROPIC_API_KEY"):
        return None
    try:
        import anthropic  # noqa: PLC0415 - optional at runtime

        client = anthropic.Anthropic()
        msg = client.messages.create(
            model="claude-sonnet-5",
            max_tokens=180,
            system=(
                "You answer a port operator's question about ONE incident using ONLY the "
                "state provided. Be factual and concise (<=2 sentences). If the state does "
                "not contain the answer, say so plainly. Never invent a status."
            ),
            messages=[{"role": "user", "content": f"Incident state:\n{_facts(inc)}\n\nQuestion: {q}"}],
        )
        parts = [b.text for b in msg.content if getattr(b, "type", None) == "text"]
        text = " ".join(p.strip() for p in parts if p).strip()
        return text or None
    except Exception:  # noqa: BLE001 - degrade to the deterministic template
        return None


def answer_query(q: str, incidents: list[Incident], incident_id: str | None = None) -> str:
    """Grounded answer to a free-text status question. Never fabricates."""
    q = (q or "").strip()
    if not q:
        return "Ask a question about an incident — for example, \"what's the status of MSC Anna?\""

    inc = resolve_incident(q, incidents, incident_id)
    if inc is None:
        return (
            "No current incident matches that question. Nothing is tracked for the entity "
            "you asked about."
        )

    return _llm_answer(q, inc) or _facts(inc)
