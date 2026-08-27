# Process notes

Cross-run process observations that don't belong to a single story. Referenced
from epic retrospectives.

---

## 2026-08-28 — `bmad-build-auto` calibration for greenfield-UI epics (Epic 2 retro item 8 / F8 / F9)

### Observation

Across Epic 2's 9 stories (all built via `bmad-build-auto`):

- **7 of 9** stories ended with `followup_review_recommended: true` (2.1, 2.2,
  2.3, 2.6, 2.7, 2.8, 2.9). **Every one** tripped purely on *low-severity
  volume* via the step-04 formula `true if any patched finding was high, OR if
  3×medium + 1×low >= 5` — none had a high-severity patch, and the medium count
  was 0 or 1. Typical low-severity patch sets: `aria-labelledby` vs `aria-label`,
  bare `font-size` literal, missing `:hover` state, barrel-export inconsistency,
  a duplicated CSS rule, a missing edge test.
- **6 of 9** specs carried the `oversized` warning (> 1600 tokens): 2.3, 2.4,
  2.5, 2.6, 2.8, 2.9.

### Why greenfield UI is different

A UI story's spec legitimately has to pin a lot of *contract* detail that a
backend story leaves implicit: exact token names, ARIA attributes and roles,
verbatim microcopy (which tests assert), focus-ring specifics, an I/O matrix per
interactive state. And a competent implementation of one UI component genuinely
surfaces 8-12 low-severity a11y/CSS refinements at review — that is the review
working, not the story being under-built. The current thresholds treat that
normal volume as a signal, so the signal stops meaning anything.

### Recommended adjustments

These values are hardcoded in the skill snapshot, **not** currently exposed by
`_bmad/custom/bmad-build-auto.toml` (which only carries `workflow.*` knobs), so
acting on them needs a skill-maintainer change or a local patch to
`~/.claude/skills/bmad-build-auto/step-02-plan.md` and `step-04-review.md`.

1. **`followup_review_recommended`** — make low-severity findings not drive it on
   their own. Either raise the low weight's contribution (e.g. `3×medium +
   0.5×low >= 6`), or gate the recommendation on `medium >= 2 || any high`, and
   route the pure-low set to a standing "polish backlog" line in the Auto Run
   Result instead of a per-story recommendation. Epic 2's actual outcome — one
   consolidated polish pass (retro item 7) — is what the seven per-story
   recommendations should have produced once.

2. **Spec-size target** — for `type: feature` stories whose Code Map is majority
   `.tsx` / `.css`, raise the soft target from 900-1600 to ~1400-2400 tokens, or
   keep the target but explicitly park token lists / ARIA tables / verbatim
   microcopy in the **Code Map** and **Design Notes** sections (which don't count
   toward the intent-contract budget the target is really protecting).

### Status

Recorded for the skill maintainer. No local skill patch applied (it would be
overwritten on the next skill update). If Epic 3 also runs UI-heavy, apply a
local patch then.
