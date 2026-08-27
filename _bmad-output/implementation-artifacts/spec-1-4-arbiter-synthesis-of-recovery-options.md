---
title: 'Story 1.4: Arbiter Synthesis of Recovery Options'
type: 'feature'
created: '2026-08-27'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: true
baseline_revision: 'b87511a5e0d2251cac12aab3252985403d3d202f'
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md']
warnings: []
deferred:
  - summary: >-
      No timeout on the arbiter `messages.create` call — a hung 4th LLM call in the
      incident pipeline blocks synthesis indefinitely.
    evidence: |-
      Blind/Edge Case Hunter. Retry, timeout tuning, and fallback are Story 1.5's
      contract (AD-13); pre-empting the envelope here would conflict with it.
    location: >-
      backend/agents/base.py (bounded_json_call -> client.messages.create)
    severity: medium
  - summary: >-
      Neither `synthesize_options` writes anything back onto the `Incident`
      (`options`, `recommended_option_id`), and there is no `Incident` field for
      `specialist_disagreement`.
    evidence: |-
      Blind Hunter + Intent Alignment + Verification Gap. AC2 requires the conflict be
      "flagged for Story 1.6"; the flag lives only on the transient `ArbiterResult`.
      Wiring `ArbiterResult` onto the incident is orchestrator work; adding an
      `Incident.specialist_disagreement` field would unilaterally expand the
      epic-1-context-pinned shared shape. Story 1.6 / the orchestrator threads it.
    location: >-
      backend/agents/dispatch.py (synthesize_options) / backend/models/incident.py
    severity: low
  - summary: >-
      No `SYNTHESIZE` trace entry is written for the arbiter call; no logging of which
      candidate won, token usage, or latency.
    evidence: |-
      Blind Hunter. Story 1.12 (Execution Trace Recording) owns per-stage trace
      entries; Story 1.4's ACs do not mention trace output.
    location: >-
      backend/agents/arbiter.py / dispatch.py
    severity: low
  - summary: >-
      `arbiter.py` exposes no interception point for the AD-16 `MOCK_AGENTS` override
      (arbiter is one of the four mockable agents).
    evidence: |-
      Intent Alignment. Story 1.13 owns the per-agent mock override; it will need to
      wrap `synthesize_options` from outside, as it also will for the specialists.
    location: >-
      backend/agents/arbiter.py
    severity: low
  - summary: >-
      The successful `client is None` path of `dispatch.synthesize_options` (construct
      real `AsyncAnthropic`, then `_maybe_close`) is unexercised; only the
      constructor-failure branch is tested.
    evidence: |-
      Verification Gap. Mirrors an already-untested equivalent path in
      `run_specialists`; the refactor did not introduce it.
    location: >-
      backend/agents/dispatch.py (synthesize_options)
    severity: low
---

<intent-contract>

## Intent

**Problem:** Story 1.3 gives an incident three independent specialist opinions (`SpecialistBundle`), but an operator needs a small, prioritized set of *real choices*, not three disconnected reads. Nothing yet turns the three recommendations into comparable recovery options with predicted impact.

**Approach:** Add an arbiter agent — one more bounded `claude-sonnet-5` Messages API call (AD-2), no tools — that takes the incident brief plus the `SpecialistBundle` and returns 1–3 ranked `RecoveryOption`s, each matching the Architecture Spine's shared shape exactly. When the specialists conflict, the options must span the disagreement (not silently pick a side) and the arbiter sets a `specialist_disagreement` flag that Story 1.6's confidence formula will penalize. Fewer than two viable options is a valid outcome, not an error.

## Boundaries & Constraints

**Always:** the arbiter is a single bounded Messages API call (`claude-sonnet-5`, AD-2), no `tools`, `tool_choice` "none", no multi-turn loop; every `RecoveryOption` matches the epic-1-context shared shape exactly (`option_id`, `description`, `predicted_impact.{delay_min, cost, yard_impact, risk}`, `reversible`, `dg_involved`); `option_id`s are stamped by our code (`opt-1`, `opt-2`, …) in ranked order, never trusted from the model; the returned option list preserves the model's ranking (best first); every failure path is a single `SpecialistError` (reused; `agent="arbiter"`) — no raw SDK / parse / validation exception escapes; the Anthropic client is injected, built lazily only when omitted (tests never touch the network).

**Block If:** the shared `RecoveryOption` / `predicted_impact` field names or enums in epic-1-context.md turn out to disagree with a shape another already-built story wrote — surface the contradiction rather than choosing one.

**Never:** no confidence scoring or tier classification (Stories 1.6/1.7) — the arbiter only *flags* disagreement, it does not compute the -10pt penalty; no DG gate or re-plan loop (Story 1.9); no execution or mock services (Story 1.11); no orchestrator task lifecycle beyond a `synthesize_options()` dispatch function; no retry/timeout/fallback (Story 1.5); no fabricating a second option to reach a count.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Normal synthesis | Incident brief + a `SpecialistBundle` of 3 recommendations; fake client returns a 3-option JSON reply | `synthesize_options()` returns an `ArbiterResult` with 3 `RecoveryOption`s, `option_id` `opt-1`/`opt-2`/`opt-3` in the model's ranked order, each with a complete `predicted_impact` (`delay_min` int ≥ 0, `cost`/`risk` in `low`/`medium`/`high`, `yard_impact` str), `reversible` and `dg_involved` bools | No error expected |
| Specialists conflict | Bundle where recommendations contradict (berth: absorb delay; yard: reroute assuming no delay); model reply sets `specialist_disagreement: true` with a `disagreement_summary` and options whose `description`/`predicted_impact` span both readings | `ArbiterResult.specialist_disagreement is True`, `disagreement_summary` non-empty, ≥2 options; the flag is preserved for Story 1.6 | No error expected |
| Only one viable option | Model reply contains exactly 1 option | `ArbiterResult` with 1 `RecoveryOption`; `len(result.options) == 1` is a valid result, not an error | No error expected |
| Model returns 0 options / bad shape | Reply is `{"options": []}`, or an option is missing `predicted_impact.risk`, or the reply is not parseable JSON, or `stop_reason` is `max_tokens`/`tool_use`/`refusal`, or `messages.create` raises | `synthesize_options()` raises `SpecialistError("arbiter", reason)` | Exception propagates (retry/fallback is Story 1.5) |
| More than 3 options | Model reply contains 4+ options | The top 3 (by the model's order) are kept and stamped `opt-1`..`opt-3`; the rest are dropped | No error expected |

</intent-contract>

## Code Map

- `backend/agents/base.py` -- existing (Story 1.3). **REFACTOR:** extract the generic "make one bounded call, handle `max_tokens`/`tool_use`/`refusal`, collect text, return JSON candidates" block from `call_specialist()` into `async def _bounded_json_call(agent_label: str, *, system: str, user_text: str, client, tools: list[dict] | None = None) -> list[dict]` (raises `SpecialistError(agent_label, …)`). `call_specialist()` then calls it and validates candidates as `SpecialistRecommendation` — its external behavior and every Story 1.3 test stay unchanged. `SpecialistError` / `SpecialistBundle` / `_incident_summary` reused as-is.
- `backend/models/recovery.py` -- new: `PredictedImpact` (`delay_min: int` ≥ 0, `cost: Literal["low","medium","high"]`, `yard_impact: str` min_length 1, `risk: Literal["low","medium","high"]`) and `RecoveryOption` (`option_id: str`, `description: str` min_length 1, `predicted_impact: PredictedImpact`, `reversible: bool`, `dg_involved: bool`) — the exact epic-1-context shared shape.
- `backend/models/incident.py` -- existing (Story 1.2). **CHANGE:** `options: list[Any]` → `options: list[RecoveryOption]` (import from `models.recovery`; default still `[]`). Story 1.2 tests construct `Incident` without `options` — unaffected. No circular import: `models.recovery` imports nothing from `models.incident`.
- `backend/agents/arbiter.py` -- new: `NAME = "arbiter"`; `SYSTEM_PROMPT` (synthesize the 3 specialist recommendations into 1–3 ranked recovery options; if they conflict, make the options span the disagreement and set `specialist_disagreement`; do not invent an option to hit a count; reply with one JSON object, no tool calls); `ArbiterResult` model (`options: list[RecoveryOption]` len 1–3, `specialist_disagreement: bool`, `disagreement_summary: str` default `""`); `async def synthesize_options(incident_brief: str, bundle: SpecialistBundle, *, client) -> ArbiterResult`. It calls `_bounded_json_call("arbiter", system=SYSTEM_PROMPT, user_text=<brief + serialized bundle>, client=client, tools=None)`, validates the first candidate whose `options` all parse as `RecoveryOption`, drops model-supplied ids and stamps `opt-1..N` in order, keeps at most the first 3, raises `SpecialistError("arbiter", …)` on 0 options / validation failure.
- `backend/agents/dispatch.py` -- existing (Story 1.3). Add `synthesize_options(incident, bundle, *, client=None)` convenience wrapper mirroring `run_specialists` (lazy `AsyncAnthropic()`, renders the brief via `_incident_summary`, best-effort client close), OR keep the lazy-default logic inside `arbiter.synthesize_options` — implementer's call, but the injected-client + `_incident_summary` reuse pattern from Story 1.3 must hold.
- `backend/tests/agents/test_arbiter.py` -- new: `FakeAsyncAnthropic` (reuse the shape from `test_specialists.py`); covers every I/O-matrix row.

## Tasks & Acceptance

**Execution:**
- `backend/models/recovery.py` -- define `PredictedImpact` and `RecoveryOption` per the shared shape.
- `backend/models/incident.py` -- retype `options` to `list[RecoveryOption]`.
- `backend/agents/base.py` -- extract `_bounded_json_call()`; re-point `call_specialist()` at it with no behavior change.
- `backend/agents/arbiter.py` -- `NAME`, `SYSTEM_PROMPT`, `ArbiterResult`, `synthesize_options()` — one bounded arbiter call, code-stamped `option_id`s, ranked-order preserved, 1–3 clamp, `SpecialistError` on failure.
- `backend/agents/dispatch.py` -- wire a `client is None` lazy-default + `_incident_summary` path for the arbiter, mirroring `run_specialists`.
- `backend/tests/agents/test_arbiter.py` -- unit-test every I/O-matrix row: 3-option happy path with stamped ids + ranked order + full `predicted_impact`; conflict → `specialist_disagreement True` + non-empty summary + ≥2 spanning options; 1-option valid; 0-options / missing `predicted_impact.risk` / unparseable / `refusal` / raised exception → `SpecialistError("arbiter")`; 4 options → top-3 kept. Also assert `call_specialist` behavior is unchanged (full suite) and that `Incident(options=[RecoveryOption(...)])` validates.

**Acceptance Criteria:**
- Given a `SpecialistBundle` and an injected fake client, when `synthesize_options()` returns, then `result.options` is 1–3 `RecoveryOption`s each exactly matching the shared shape, with `option_id` values `opt-1..N` assigned by our code in the model's ranked order.
- Given contradicting specialist recommendations, when the arbiter synthesizes, then `result.specialist_disagreement is True` and `result.disagreement_summary` is non-empty, and no option is silently dropped in favour of one side.
- Given the full backend test suite, when run, then it passes (Stories 1.1–1.3 + new) with no network access and no `ANTHROPIC_API_KEY` set.

## Spec Change Log

## Review Triage Log

### 2026-08-27 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 14: (high 0, medium 4, low 10)
- defer: 5: (high 0, medium 1, low 4)
- reject: 4
- addressed_findings:
  - `[medium]` `[patch]` `disagreement_summary` was not required when `specialist_disagreement is True` (AC row 2) — added an `ArbiterResult` model-validator; empty summary on conflict now raises `SpecialistError("arbiter")`.
  - `[medium]` `[patch]` A single malformed option in the top 3 failed the whole synthesis — now survivors are kept and restamped `opt-1..N`; only zero survivors moves to the next candidate.
  - `[medium]` `[patch]` `RecoveryOption` / `PredictedImpact` accepted unexpected keys at the untrusted-model-output boundary — `extra="forbid"`; both `option_id` and `id` stripped before validation.
  - `[medium]` `[patch]` Arbiter shared the specialists' 4096 `max_tokens` despite a larger synthesis job — `bounded_json_call` now takes a `max_tokens` param; arbiter passes 8192.
  - `[low]` `[patch]` Delimiter neutralisation only escaped the exact `</specialist-analyses>` — broadened (regex, case/whitespace, both tag families) in `_render_arbiter_input` and, for consistency, `base._incident_summary`; delimiter-injection test added.
  - `[low]` `[patch]` `_bounded_json_call` → public `bounded_json_call`; `if tools:` guard; unknown `stop_reason` → `SpecialistError`; `_collect_text`/`_json_candidates` moved inside the wrapped `try`.
  - `[low]` `[patch]` `synthesize_options` now guards the bundle is a `SpecialistBundle` of exactly 3; free-text/numeric upper bounds (`yard_impact` 500, `disagreement_summary` 2000, `delay_min` ≤ 100000); `_MAX_OPTIONS` comment corrected; asymmetry (malformed-in-top-3 skipped vs 4th+ never seen) documented.
  - `[low]` `[patch]` Tests: specialist-path `tool_choice` still forwarded post-refactor; malformed option at positions 1/2; first-candidate-invalid → second wins; 2-recommendation bundle → error; delimiter neutralisation + case variant.
  - Deferred: no `messages.create` timeout (Story 1.5); no `SYNTHESIZE` trace entry / logging (Story 1.12); `ArbiterResult` not written back onto `Incident` and no `Incident.specialist_disagreement` field — orchestrator / Story 1.6 threads `ArbiterResult` (adding `Incident` fields would unilaterally expand the epic-pinned shared shape); no AD-16 `MOCK_AGENTS` seam in `arbiter.py` (Story 1.13); successful `client is None` real-`AsyncAnthropic` path untested (mirrors an existing `run_specialists` gap).
  - Rejected: `SpecialistError("dispatch")` vs `("arbiter")` label split (established in Story 1.3's `run_specialists`; 1.5 catches `SpecialistError` regardless of `.agent`); strict-`int` `delay_min` rejecting `30.5` (P9 leniency bounds the blast radius); "existing loosely-shaped `Incident.options` fixtures" (grep confirms none — `list[Any]` had no other construction site); speculative `TOOL_MANIFEST = None` (all three modules define non-empty lists).

## Design Notes

**`SpecialistError` is reused for the arbiter** (with `agent="arbiter"`) rather than adding a parallel `ArbiterError` — the shared `_bounded_json_call()` raises one type and callers already handle it; the class name is imperfect but not worth the churn to Story 1.3's tests. If a later story wants a common name, rename to `AgentError` with a `SpecialistError` alias.

**`option_id` is stamped, not parsed.** The model is asked only for `description` / `predicted_impact` / `reversible` / `dg_involved` per option; our code assigns `opt-1..N` in the order the model returns them. This guarantees uniqueness and a stable id scheme the policy engine (Story 1.7) and approval flow (Epic 2) can rely on, and keeps ranking = list order.

**Disagreement is flagged, not scored.** `specialist_disagreement` is a boolean the arbiter sets from reading the three recommendations; Story 1.6 turns it into the flat -10pt confidence penalty (epic-1-context). Story 1.4 must not compute confidence or drop the flag.

## Verification

**Commands:**
- `cd backend && uv run --with pydantic --with pytest --with anthropic --python 3.12 pytest tests/agents/ -v` -- expected: arbiter + specialist tests pass, zero failures, no network.
- `cd backend && uv run --with pydantic --with pytest --with anthropic --python 3.12 pytest -q` -- expected: full suite green (Stories 1.1–1.3 + new), proving the `base.py` refactor caused no regression.

## Auto Run Result

Status: done

**Implemented change.** `backend/agents/arbiter.py` — one more bounded `claude-sonnet-5` Messages API call (AD-2), no tools, `max_tokens` 8192 — takes the incident brief + Story 1.3's `SpecialistBundle` and returns an `ArbiterResult`: 1–3 ranked `RecoveryOption`s (epic-1-context shared shape) with `option_id` code-stamped `opt-1..N` in the model's ranked order, plus `specialist_disagreement` / `disagreement_summary` for Story 1.6. New `backend/models/recovery.py` (`RecoveryOption`, `PredictedImpact`, `extra="forbid"`). `Incident.options` retyped `list[Any]` → `list[RecoveryOption]`. `base.py` refactor: shared `bounded_json_call()` (the specialist + arbiter call half) and `_neutralise_delimiters()`.

**Files changed.**
- `backend/agents/base.py` — extracted public `bounded_json_call(agent_label, *, system, user_text, client, tools=None, max_tokens=MAX_TOKENS)`; shared `_neutralise_delimiters()`; unknown `stop_reason` → `SpecialistError`; parse/collect now inside the wrapped `try`. `call_specialist` behavior unchanged.
- `backend/models/recovery.py` — new. `backend/models/incident.py` — `options: list[RecoveryOption]`.
- `backend/agents/arbiter.py` — new: `NAME`, `SYSTEM_PROMPT`, `ArbiterResult` (1–3 options, disagreement-summary cross-validator), `synthesize_options(incident_brief, bundle, *, client)`.
- `backend/agents/dispatch.py` — new `synthesize_options(incident, bundle, *, client=None)` wrapper mirroring `run_specialists` (brief rendered once via `_incident_summary` — AD-4; lazy client; failures as `SpecialistError`).
- `backend/tests/agents/test_arbiter.py` — new, 35 tests. `backend/tests/agents/test_specialists.py` — +`tool_choice` assertion post-refactor.

**Review findings breakdown.** 14 patches applied (0 high / 4 medium / 10 low) — see Review Triage Log. 5 deferred (frontmatter `deferred`): no `messages.create` timeout (1.5); no `SYNTHESIZE` trace entry (1.12); `ArbiterResult` not wired onto `Incident` + no `Incident.specialist_disagreement` field (orchestrator / 1.6 threads it); no AD-16 `MOCK_AGENTS` seam (1.13); successful real-`AsyncAnthropic` path untested. 4 rejected.

**Follow-up review recommendation:** `true`. Patched findings: 0 high, 4 medium, 10 low → score `3×4 + 1×10 = 22` ≥ 5.

**Verification performed.**
- `pytest tests/agents/ -v` → `67 passed` (35 arbiter + 32 specialist).
- `pytest -q` (full suite) → `120 passed` (Stories 1.1–1.4), no regression from the `base.py` refactor, no network, no `ANTHROPIC_API_KEY`.
Re-run independently after the patch pass: `120 passed`.

**Residual risks.** No live Anthropic call is exercised — the real `AsyncAnthropic()` path, `claude-sonnet-5` id, `tool_choice`/tools omission, and the 8192-token budget are unverified until an integration/demo run. `ArbiterResult` currently has no persistence path onto the `Incident`; Story 1.6 and the orchestrator must thread `specialist_disagreement` through. Retry/timeout/fallback is Story 1.5; `SYNTHESIZE` trace is Story 1.12.
