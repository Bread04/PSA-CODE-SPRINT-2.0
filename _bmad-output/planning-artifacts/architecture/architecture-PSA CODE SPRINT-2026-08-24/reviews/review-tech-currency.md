# Tech-Currency Review — 2026-08-30

**Scope:** `ARCHITECTURE-SPINE.md` (Portwatch build spine). Lens: verify every committed
technology decision was web-researched / reality-checked rather than asserted from a training
prior. Version claims below were checked against live web sources on 2026-08-30; the Anthropic
offering (model id, AD-2 primitives) was checked against the bundled `claude-api` skill
(Current Models table cached 2026-06-24) plus reasoning about the current API surface.

**Verdict: PASS WITH CONCERNS.**

The `## Stack` table is mostly the product of real reality-checking — Python, FastAPI and
React each carry a "verified current" annotation that matches the live version to the exact
number. Two rows were not refreshed and reflect a stale prior (TypeScript) or drifted one
minor behind (Vite). Neither is a material risk for a 6-day hackathon. The Claude model id
and the AD-2 characterization of Anthropic's agent primitives are accurate as stated.

---

## Findings

### 1. TypeScript "5.x current stable" — STALE, not reality-checked  (low build risk)

Spine says: `TypeScript | 5.x current stable`.

As of August 2026 the current stable TypeScript is **7.0** (7.0.2), which ships the native
Go compiler; **6.0** shipped March 2026 as a transitional release on the old JS codebase.
"5.x current stable" is two major versions behind and is the one row in the table with no
"verified" annotation and no plausible 2026 basis — it reads as a pre-2026 training prior
carried in unchecked.

Impact on the build: negligible. Any TS 5/6/7 compiles this frontend; Vite handles
transpilation. But per the review lens this row was asserted, not researched.

Recommendation: change to `5.9+ (7.0 is current stable as of 2026-08; 5.x floor is fine —
Vite transpiles, no tsc build gate)` or simply `7.x current / 5.x+ acceptable`.

### 2. Vite "8.1.3 (verified current, mid-2026)" — one minor behind; annotation overstates confidence  (negligible build risk)

Spine says: `Vite | 8.1.3 (verified current, mid-2026)`.

Timeline confirmed on the web: Vite 8.0 — March 2026; Vite 8.1 — 23 June 2026; Vite 8.2.x —
released late July / August 2026. So on 2026-08-30 the current line is **8.2.x**, not 8.1.3.
8.1.3 is a real, plausible version (the 8.1 line exists), so this is drift, not fabrication —
but the parenthetical "verified current, mid-2026" is now inaccurate given the frontmatter
says the doc was updated 2026-08-29, by which point 8.2 was out.

Recommendation: bump to `8.2.x (current as of 2026-08)` or soften to `8.x (Rolldown-based;
8.1+)`. Note Vite 8 is a large architectural change (Rolldown/Rust replaces esbuild+Rollup) —
worth a one-line flag that plugin-compat edge cases exist, though the spine's frontend is
small enough that this is unlikely to bite.

### 3. Claude model id `claude-sonnet-5` — VALID and latency-appropriate  (no action)

`claude-sonnet-5` is a real, current model id (Anthropic Current Models table: Claude
Sonnet 5, 1M context, $2/$10 per MTok). It is the correct tier for AD-13's ~20-30s
golden-path budget across parallel specialist calls: Sonnet 5 is Anthropic's mid-tier —
materially faster and ~5x cheaper on input than Opus 5 — and the spine explicitly keeps
"swap the arbiter to a stronger model" as a same-day tuning knob, which is the right hedge.
No date suffix is appended (correct — the bare id is complete). This decision looks
reality-checked, not asserted.

One neutral note: the `claude-api` skill's own default is `claude-opus-5`; the spine's
choice of Sonnet is a deliberate, documented latency/cost tradeoff, which is legitimate.

### 4. AD-2 — "Agent SDK / Tool Runner / Managed Agents multi-agent sessions" as distinct primitives — ACCURATE  (no action)

AD-2 rules out implementing agents "via the Claude Agent SDK, Tool Runner, or Managed Agents
multi-agent sessions" in favour of direct Messages API calls. This is an accurate description
of the current Anthropic offering:

- **Claude Agent SDK** (`claude-agent-sdk` / `@anthropic-ai/claude-agent-sdk`) — a separate
  product: Claude Code packaged as a library with built-in file/bash/web tools and a full
  agent loop. Broader surface than scoped tool use needs — the spine's rationale holds.
- **Tool Runner** — `client.beta.messages.tool_runner`, an SDK helper (beta) that drives the
  request→execute→loop cycle for tools you define. Real, correctly characterized as
  loop machinery the single-process design (AD-1) doesn't need.
- **Managed Agents** — server-managed stateful agents with an Anthropic-hosted per-session
  sandbox; **multiagent sessions** (delegating to sub-agents by roster) are a documented
  feature. Correctly characterized as session/process machinery AD-9/AD-10 make redundant.

The three are genuinely distinct and the spine's "we don't need any of them, we make bounded
request/response calls" is a sound, current read. Minor wording nit only: "Tool Runner" is a
beta SDK helper rather than a standalone product, but the spine doesn't overclaim.

### 5. Python "3.14 is current stable; 3.12 floor" — ACCURATE and well-reasoned  (no action)

Python 3.14 released 7 Oct 2025; current maintenance release 3.14.7 (5 Aug 2026). The
spine's annotation is exactly right, and choosing 3.12 as a broad-compat floor for
async/LLM libraries (rather than a stale default) is explicitly reasoned. Reality-checked.

### 6. FastAPI "~0.141.x (verified current, released July 2026)" — ACCURATE  (no action)

Confirmed: FastAPI 0.141.1 was ~the 300th release, late July 2026; cadence is multiple
minor releases per month. By end of August 2026 the current version may be marginally
higher (~0.14x), but the `~0.141.x` framing with the "July 2026" date is honest and clearly
researched. No pin risk — FastAPI minors are non-breaking in practice.

### 7. React "19.2.8 (verified current, mid-2026)" — ACCURATE to the exact patch  (no action)

Confirmed: React 19.2.8 released 21 July 2026. No 19.3 / 20 announced. This row was checked
against the actual release feed, not guessed.

### 8. Anthropic Python SDK "latest stable" — safe, one note  (no action)

Unpinned "latest stable" is fine. Note for implementers: the Python SDK is now on 1.x (a
major bump from 0.x — httpx2, awaited async raw-response, removed deprecated params). "Latest
stable" resolves correctly; just don't copy 0.x call patterns from old snippets.

---

## Summary table

| Stack row | Claimed | Actual (2026-08-30) | Status |
| --- | --- | --- | --- |
| Python | 3.14 current, 3.12 floor | 3.14.7 current | Accurate |
| FastAPI | ~0.141.x, Jul 2026 | ~0.141.1 late Jul 2026 | Accurate |
| Anthropic Python SDK | latest stable | 1.x line | OK (unpinned) |
| Claude model | `claude-sonnet-5` | valid current id, mid-tier | Accurate, latency-appropriate |
| React | 19.2.8, mid-2026 | 19.2.8 (21 Jul 2026) | Accurate |
| TypeScript | 5.x current stable | 7.0 stable; 6.0 transitional | **Stale — not researched** |
| Vite | 8.1.3, "verified current" | 8.2.x current; 8.1 was Jun 2026 | **One minor behind** |
| AD-2 agent primitives | 3 distinct primitives, ruled out | accurate characterization | Accurate |

## Recommended edits (non-blocking)

1. TypeScript row → `5.9+ acceptable (7.0 is current stable as of 2026-08; no tsc build gate — Vite transpiles)`.
2. Vite row → `8.2.x (current as of 2026-08; Rolldown/Rust bundler — 8.x is a large internal change, small frontend so low risk)`.
3. Optionally soften the FastAPI parenthetical to "as of July 2026" (already effectively done).
4. No change needed to the Claude model id or AD-2.
