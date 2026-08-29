/**
 * Portwatch Console — frontend incident data shapes (Story 2.3).
 *
 * These interfaces mirror the backend Pydantic models VERBATIM:
 *   - `backend/models/incident.py`  → `Incident`, `TraceEntry`
 *   - `backend/models/recovery.py`  → `RecoveryOption`, `PredictedImpact`
 *
 * Field names are the raw JSON keys the API emits (snake_case). Do NOT rename
 * them to camelCase and do NOT add fields the backend does not send
 * (`title`, `summary`, `resolution_outcome`, … do not exist). Display strings
 * are derived from this real shape by the IncidentFeed helpers.
 */

/** Policy tier, or `null` before classification (Story 1.7). */
export type Tier = 1 | 2 | 3 | null;

/** `Incident.status` — Story 1.2 only ever creates `"open"`. */
export type IncidentStatus = 'open' | 'resolved';

/** `Incident.approval_status`. */
export type ApprovalStatus = 'n/a' | 'pending' | 'approved' | 'rejected';

/** Relative band used by `PredictedImpact.cost` / `.risk`. */
export type ImpactBand = 'low' | 'medium' | 'high';

/** The forecast consequence of taking a recovery option. */
export interface PredictedImpact {
  delay_min: number;
  cost: ImpactBand;
  yard_impact: string;
  risk: ImpactBand;
}

/** One ranked recovery choice the arbiter offers (Story 1.4). */
export interface RecoveryOption {
  option_id: string;
  description: string;
  predicted_impact: PredictedImpact;
  reversible: boolean;
  dg_involved: boolean;
}

/** Fixed failure shape carried on a trace step, or `null` when it succeeded. */
export interface TraceError {
  stage: string;
  error: string;
  retried: boolean;
  fallback_used: boolean;
}

/** The frozen specialist roster — exactly these three, this order (AD-19). */
export type AgentName = 'berth' | 'crane' | 'yard';

/**
 * One specialist's analysis, exposed read-only for the Harbor Signal agent
 * roster (AD-19). This is the validated bundle the orchestrator already passes
 * to the arbiter — the same objects, not recomputed — surfaced on
 * `GET /incidents/{id}`. `[]` until the `AGENT_CALL` stage runs.
 */
export interface AgentRecommendation {
  agent: AgentName;
  summary: string;
  actions: string[];
  /** Limits / preconditions the arbiter must respect. */
  constraints: string[];
  rationale: string;
}

/** One append-only step in an incident's execution trace. */
export interface TraceEntry {
  /** SCREAMING_SNAKE stage name, e.g. `"CORRELATE"`, `"CONFIDENCE"`. */
  stage: string;
  /** ISO 8601 UTC timestamp. */
  timestamp: string;
  /** Stage-specific structured context (`mock_forced`, `reason`, …). */
  detail: Record<string, unknown>;
  error: TraceError | null;
}

/** The mutable per-disruption record, as served by `GET /incidents`. */
export interface Incident {
  incident_id: string;
  status: IncidentStatus;
  entity_refs: string[];
  tier: Tier;
  /** Deterministic score 0–100; starts at 100 before penalties (Story 1.6). */
  confidence: number;
  recommended_option_id: string | null;
  options: RecoveryOption[];
  approval_status: ApprovalStatus;
  blocked_by_kill_switch: boolean;
  /** Validated specialist bundle, read-only (AD-19); `[]` until AGENT_CALL runs. */
  agents: AgentRecommendation[];
  trace: TraceEntry[];
  /** ISO 8601 UTC time of the signal that created this incident. */
  created_at: string;
  /** ISO 8601 UTC time of the most recent correlated signal. */
  last_signal_at: string;
}
