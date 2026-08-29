export type ApprovalTier = "1" | "2" | "3";
export type ApprovalState = "pending" | "approved" | "rejected" | "auto_executed";
export type OperationalDomain = "berth" | "yard" | "weather" | "equipment" | "staffing";
export type DecisionStatus = "monitoring" | "recommended" | "approval_required" | "executing" | "resolved" | "rejected" | "safe_fallback";

export type RecommendationOption = {
  id: string;
  label: string;
  impact: string;
  confidence: number;
  riskLevel: "low" | "medium" | "high";
  tradeOffs: string[];
  assumptions: string[];
  requiredApprovalTier: ApprovalTier;
  executionPlan: string[];
  summary: string;
};

export type AuditEvent = {
  timestamp: string;
  eventType: string;
  summary: string;
  actor: string;
  status: "resolved" | "approved" | "rejected" | "auto-executed" | "executing";
  hashOrReference: string;
};

export type DisruptionRecord = {
  id: string;
  sourceEvent: string;
  timestamp: string;
  operationalDomain: OperationalDomain;
  objective: string;
  evidence: string[];
  constraints: string[];
  options: RecommendationOption[];
  confidence: number;
  approvalTier: ApprovalTier;
  approvalState: ApprovalState;
  executionStatus: DecisionStatus;
  auditTrail: AuditEvent[];
};
