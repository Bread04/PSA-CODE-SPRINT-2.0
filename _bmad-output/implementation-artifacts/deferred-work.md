- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-signal-ingestion-normalization.md`
  summary: Signal normalization does not semantically validate field values (e.g. `eta` timestamp format, `congestion_level`/`queue_length` numeric and non-negative) — only presence/blankness is checked.
  evidence: Blind-hunter and edge-case-hunter review of Story 1.1's diff both flagged that malformed-but-present values (e.g. `eta: "not-a-date"`, `congestion_level: -5`) pass normalization silently. Story 1.1's frozen spec scoped this story to structural normalization only; deeper validation was never in its I/O matrix.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-signal-ingestion-normalization.md`
  summary: Entity ids/types are not normalized for case or whitespace, and are not checked for embedded `:` characters, before being passed into `make_entity_ref()`.
  evidence: Edge-case-hunter review of Story 1.1: two signals referencing "the same" entity with inconsistent casing/whitespace (e.g. `"C7-3"` vs `" c7-3 "`) would silently fail to correlate in Story 1.2, and an id containing `:` would corrupt the fixed `type:id` format's parse-back assumption. Low risk while all producers are internal/controlled, but worth hardening before Story 1.2 (correlation) or Story 3.x's mock services are built on top of it.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-signal-ingestion-normalization.md`
  summary: `_handle_dg_exception` only includes `container_id` in `entity_refs`, dropping the required `vessel_id` field from correlation even though FR2 correlates on "same vessel/berth/crane/yard block."
  evidence: Blind-hunter review flagged this as an unexplained asymmetry (vessel_id is required but not used for correlation for this signal type, unlike every other type where all id fields feed entity_refs). Not fixed now because it's a design question for Story 1.2 (correlation) to weigh in on — whether DG exceptions should correlate at the vessel level in addition to the container level — rather than a defect in Story 1.1's own contract.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-signal-ingestion-normalization.md`
  summary: No allowlist/type-checking on non-`operator_request` entity id fields (crane_id, yard_block_id, gate_id, area_id, container_id, vessel_id) confirming they are strings before being embedded in `entity_refs`.
  evidence: Edge-case-hunter review: a non-string id (int, list, dict) passed through any handler would produce a malformed-looking but "accepted" entity_ref instead of a rejection. Same root cause as the `operator_request` entity_type allowlist patch applied in this story's review, but broader in scope — deferred rather than expanding this story's patch set beyond what the review specifically demonstrated as exploitable.
