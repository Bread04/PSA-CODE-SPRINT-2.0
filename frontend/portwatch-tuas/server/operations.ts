import type {
  ApprovalState,
  ApprovalTier,
  AuditEvent,
  DecisionStatus,
  DisruptionRecord,
  RecommendationOption,
} from "../shared/domain";

const makeTimestamp = (offsetMinutes = 0) => {
  const date = new Date();
  date.setMinutes(date.getMinutes() + offsetMinutes);
  return date.toISOString();
};

const createAudit = (
  eventType: string,
  summary: string,
  actor: string,
  status: AuditEvent["status"],
  hashOrReference: string,
): AuditEvent => ({
  timestamp: makeTimestamp(),
  eventType,
  summary,
  actor,
  status,
  hashOrReference,
});

const createDisruption = (
  id: string,
  sourceEvent: string,
  operationalDomain: DisruptionRecord["operationalDomain"],
  objective: string,
  evidence: string[],
  constraints: string[],
  options: RecommendationOption[],
  confidence: number,
  approvalTier: ApprovalTier,
): DisruptionRecord => ({
  id,
  sourceEvent,
  timestamp: makeTimestamp(),
  operationalDomain,
  objective,
  evidence,
  constraints,
  options,
  confidence,
  approvalTier,
  approvalState: "pending",
  executionStatus: "approval_required",
  auditTrail: [
    createAudit("event_intake", `${sourceEvent} observed in live operations feed.`, "auto", "resolved", `${id.toUpperCase()}-INTAKE`),
    createAudit("objective_detection", `Objective inferred as ${objective.toLowerCase()}.`, "policy.engine", "resolved", `${id.toUpperCase()}-OBJECTIVE`),
  ],
});

const nexusOptions: RecommendationOption[] = [
  {
    id: "a",
    label: "Re-sequence berth window",
    impact: "Fastest recovery with moderate SLA risk",
    confidence: 0.81,
    riskLevel: "medium",
    tradeOffs: ["55 minute vessel delay", "Higher berth coupling risk", "SLA variance if downstream queue remains tight"],
    assumptions: ["Crane #4 can be isolated without full outage", "Berth B3 still has enough labor coverage", "Yard blocks can absorb short-term queue"],
    requiredApprovalTier: "3",
    executionPlan: ["Freeze berth handoff window", "Reroute crane sequencing", "Notify quay team and scheduler"],
    summary: "Use a short re-sequencing window to preserve B3 throughput while the fault is isolated.",
  },
  {
    id: "b",
    label: "Split discharge across C5 / C8",
    impact: "Balanced throughput and controlled risk",
    confidence: 0.76,
    riskLevel: "medium",
    tradeOffs: ["42 minute vessel delay", "+$18k handling cost", "Requires labor handoff across two blocks"],
    assumptions: ["Adjacent crane coverage is available", "Yard capacity across C5 and C8 remains stable", "No simultaneous weather stress is active"],
    requiredApprovalTier: "2",
    executionPlan: ["Shift container discharge assignment", "Rebalance yard support staff", "Track downstream dwell time"],
    summary: "Distribute work across adjacent berth support lanes to smooth flow without a hard-stop recovery.",
  },
  {
    id: "c",
    label: "Hold and reassess",
    impact: "Lowest immediate change, highest downstream disruption",
    confidence: 0.59,
    riskLevel: "high",
    tradeOffs: ["Vessel delay exceeds 90 minutes", "Berth queue becomes unstable", "Increased overtime and schedule volatility"],
    assumptions: ["No full crisis escalations are active", "Weather remains benign", "Queue pressure can tolerate a deliberate pause"],
    requiredApprovalTier: "3",
    executionPlan: ["Pause non-critical moves", "Re-run berth load forecast", "Escalate to duty manager if ETA continues to slip"],
    summary: "Hold momentarily and wait for clearer vessel and berth data before committing to a disruptive sequence.",
  },
];

const weatherOptions: RecommendationOption[] = [
  {
    id: "a",
    label: "Stage wind safety perimeter",
    impact: "Fastest safety protection with low operational exposure",
    confidence: 0.91,
    riskLevel: "low",
    tradeOffs: ["Temporary berth reduction", "Short delay in high-priority moves", "Needs staff reassignment"],
    assumptions: ["Projected gusts remain above safety threshold", "Western berths are the highest exposure points", "AGV lanes can be pinned without chain delays"],
    requiredApprovalTier: "1",
    executionPlan: ["Arm wind safety perimeter", "Lock AGV routes", "Reassign marshals to western berths"],
    summary: "Protect the exposed western lanes before the gust threshold becomes a hard safety event.",
  },
  {
    id: "b",
    label: "Rebalance yard coverage",
    impact: "Operational continuity maintained with moderate disruption",
    confidence: 0.82,
    riskLevel: "medium",
    tradeOffs: ["Some yard capacity shifts to sheltered blocks", "Higher crew coordination complexity", "Slightly slower truck turn time"],
    assumptions: ["Sheltered blocks can take extra load", "Weather front remains localized", "Safety marshals can support the handoff"],
    requiredApprovalTier: "2",
    executionPlan: ["Shift yard staff to sheltered blocks", "Hold at-risk lane loading", "Monitor AGV throughput"],
    summary: "Balance the workforce and sheltered yard blocks to absorb the incoming weather disruption without a full-stop safety event.",
  },
  {
    id: "c",
    label: "Full lockdown and reassessment",
    impact: "Maximum safety but broadest operational disruption",
    confidence: 0.67,
    riskLevel: "high",
    tradeOffs: ["Berths and yard throughput stall", "Fleet turnaround delays propagate across the day", "Large number of moves are deferred"],
    assumptions: ["Forecast wind threshold exceeds operating band", "No safe partial operating mode exists", "Manual decision support is available"],
    requiredApprovalTier: "3",
    executionPlan: ["Lock AGV lanes", "Suspend at-risk moves", "Notify all shifts and record all-clear path"],
    summary: "Apply a full lockdown if the squall crosses the operating threshold and partial mitigation is no longer safe.",
  },
];

const disruptionSeed: DisruptionRecord[] = [
  createDisruption(
    "nexus-b3-delay",
    "Singapore Nexus Disruption",
    "berth",
    "Protect berth utilization and minimize vessel turnaround delay",
    [
      "MSC Anna ETA shifted by 90 minutes",
      "Crane #4 hydraulic telemetry failed during the handoff window",
      "B3 and adjacent yard blocks show convergence risk within the next 30 minutes",
    ],
    [
      "Yard resources must stay within safe berth coupling limits",
      "Operator approval is required before any material schedule change",
      "Downstream vessel delay is a priority risk to contain",
    ],
    nexusOptions,
    0.82,
    "3",
  ),
  createDisruption(
    "squall-western-berths",
    "Sumatra Squall — Micro-Climate Lockdown",
    "weather",
    "Protect safety thresholds while preserving the fastest viable recovery path",
    [
      "Projected gusts exceed 55 kt in western operational corridor",
      "AGV routes and berth exposers are at elevated wind risk",
      "Weather watch is in effect for the next two hours",
    ],
    [
      "Safety thresholds may not be negotiable under a live weather event",
      "Any manual override should remain visible and auditable",
      "Partial operating modes are preferable to full-stop only when safe",
    ],
    weatherOptions,
    0.89,
    "2",
  ),
];

export const operationsState = {
  disruptions: disruptionSeed,
};

export function listDisruptions() {
  return operationsState.disruptions.map((disruption) => ({
    ...disruption,
    options: disruption.options.map((option) => ({ ...option })),
    auditTrail: [...disruption.auditTrail],
  }));
}

export function getDisruptionById(id: string) {
  const disruption = operationsState.disruptions.find((item) => item.id === id);
  if (!disruption) {
    return null;
  }

  return {
    ...disruption,
    options: disruption.options.map((option) => ({ ...option })),
    auditTrail: [...disruption.auditTrail],
  };
}

export function getOverview() {
  const disruptions = listDisruptions();
  const pendingApproval = disruptions.filter((item) => item.approvalState === "pending" || item.executionStatus === "approval_required").length;

  return {
    status: "monitoring",
    activeDisruptions: disruptions.length,
    pendingApproval,
    kpis: {
      yardUtilization: 78.4,
      vesselsTracked: 14,
      equipmentHealth: "17 / 18",
      operatorQueue: pendingApproval > 0 ? "1 review required" : "all clear",
    },
    domains: disruptions.map((item) => ({
      id: item.id,
      domain: item.operationalDomain,
      objective: item.objective,
      confidence: item.confidence,
      approvalTier: item.approvalTier,
      status: item.executionStatus,
    })),
  };
}

export function applyDecision(
  disruptionId: string,
  optionId: string,
  input: { actor?: string; approved?: boolean; summary?: string; },
) {
  const disruption = operationsState.disruptions.find((item) => item.id === disruptionId);
  if (!disruption) {
    throw new Error(`Disruption ${disruptionId} not found`);
  }

  const option = disruption.options.find((item) => item.id === optionId) ?? disruption.options[0];
  const approved = input.approved ?? true;
  const actor = input.actor ?? "Ops Duty Manager";
  const summary = input.summary ?? `${option.label} ${approved ? "approved" : "rejected"}`;

  const nextApprovalState: ApprovalState = approved ? "approved" : "rejected";
  const nextDecisionStatus: DecisionStatus = approved ? "executing" : "rejected";

  disruption.approvalState = nextApprovalState;
  disruption.executionStatus = approved ? "executing" : "rejected";
  disruption.auditTrail.push(
    createAudit(
      approved ? "decision_approved" : "decision_rejected",
      summary,
      actor,
      approved ? "approved" : "rejected",
      `${disruption.id.toUpperCase()}-${option.id.toUpperCase()}-${approved ? "APPROVED" : "REJECTED"}`,
    ),
  );

  if (approved) {
    disruption.executionStatus = "resolved";
    disruption.auditTrail.push(
      createAudit(
        "execution_recorded",
        `Execution plan recorded for ${option.label}.`,
        actor,
        "resolved",
        `${disruption.id.toUpperCase()}-${option.id.toUpperCase()}-EXEC`,
      ),
    );
  }

  return getDisruptionById(disruptionId);
}
