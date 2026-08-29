/* Harbor Signal design reminder: calm neo-industrial instrument language, asymmetric command rail, visible confidence/policy boundaries, and signal colors used only for state. */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Anchor,
  ArrowDownRight,
  ArrowRight,
  Bell,
  BookOpen,
  Boxes,
  BrainCircuit,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  ClipboardCheck,
  CloudLightning,
  CloudRain,
  Compass,
  Container,
  Cpu,
  FileClock,
  Gauge,
  GitBranch,
  HelpCircle,
  Info,
  LayoutDashboard,
  LifeBuoy,
  ListChecks,
  LockKeyhole,
  Map as MapIcon,
  MapPin,
  Menu,
  Network,
  Pause,
  Play,
  Radio,
  RotateCcw,
  Route,
  ScanLine,
  ServerCog,
  ShieldCheck,
  Ship,
  SlidersHorizontal,
  Terminal,
  Timer,
  TriangleAlert,
  UserRound,
  UsersRound,
  Waves,
  Wind,
  X,
  Zap,
} from "lucide-react";
import {
  CornerMark,
  CountdownBar,
  LinkButton,
  MetricCard,
  Panel,
  RailButton,
  SectionHeading,
  SignalTag,
  StatusPill,
  TinySparkline,
  type SignalTone,
} from "@/components/PortwatchPrimitives";

type ViewId = "command" | "simulator" | "audit";
type ScenarioId = "nexus" | "squall";
type ScenarioStatus = "idle" | "running" | "approval" | "executing" | "resolved" | "lockdown";
type DecisionTier = "1" | "2" | "3";
type RadarState = { status: "loading" | "live" | "fallback"; imageUrl?: string; capturedAt?: string; updatedAt?: string; label?: string; range?: string; error?: string };
type RadarApiResponse = { code: number; errorMsg?: string; data?: { records?: { timestamp: string; updatedTimestamp: string; image?: { url?: string; urlExpiresAt?: string; label?: string; range?: string; format?: string } }[] } };
type MapLayer = "berths" | "yards" | "routes";
type VesselStatus = "Traveling" | "At Berth" | "Delayed" | "Fault Alert";
type Vessel = {
  id: string;
  fleet: string;
  name: string;
  type: string;
  flag: string;
  origin: string;
  originCode: string;
  destination: string;
  destinationCode: string;
  progress: number;
  status: VesselStatus;
  departure: string;
  scheduled: string;
  estimated: string;
  currentLocation: string;
  stops: string;
};

type WorkforceType = "nexus" | "squall" | "yard-surge";
type StaffingRecommendation = {
  id: string;
  type: WorkforceType;
  label: string;
  from: string;
  to: string;
  headcount: number;
  duration: string;
  fromLoad: string;
  toLoad: string;
  confidence: string;
  rationale: string;
  affectedShift: string;
};
type ApprovalHistoryRow = {
  id: string;
  time: string;
  recommendation: string;
  affectedShift: string;
  operator: string;
  status: "Approved";
};

type LogEntry = {
  time: string;
  title: string;
  body: string;
  tone?: "warning" | "critical" | "resolved";
};

type AuditRow = {
  time: string;
  event: string;
  tier: string;
  decision: string;
  operator: string;
  status: "Resolved" | "Approved" | "Rejected" | "Auto-executed";
  hash?: string;
};

const navItems: { id: ViewId; label: string; icon: typeof LayoutDashboard; badge?: string }[] = [
  { id: "command", label: "Dashboard", icon: LayoutDashboard },
  { id: "simulator", label: "Active incidents", icon: TriangleAlert, badge: "2" },
  { id: "audit", label: "Audit trail", icon: FileClock },
];

const fleetTabs = ["fleet-1", "fleet-2", "fleet-3"] as const;
const fleetLabels: Record<string, string> = { "fleet-1": "Fleet 1", "fleet-2": "Fleet 2", "fleet-3": "Fleet 3" };
const vesselData: Vessel[] = [
  { id: "msc-anna", fleet: "fleet-1", name: "MSC Anna", type: "Container Ship", flag: "🇵🇦", origin: "Port Klang", originCode: "PKL", destination: "Tuas", destinationCode: "SGT", progress: 72, status: "Traveling", departure: "14:20 SGT", scheduled: "16:00 SGT", estimated: "16:00 SGT", currentLocation: "Malacca Strait / 02°14′N 103°45′E", stops: "None" },
  { id: "pacific-lark", fleet: "fleet-1", name: "Pacific Lark", type: "Container Ship", flag: "🇱🇷", origin: "Colombo", originCode: "CMB", destination: "Tuas", destinationCode: "SGT", progress: 58, status: "Traveling", departure: "09:40 SGT", scheduled: "18:20 SGT", estimated: "18:20 SGT", currentLocation: "Westbound approach / 01°08′N 103°09′E", stops: "None" },
  { id: "mv-kestrel", fleet: "fleet-2", name: "MV Kestrel", type: "Oil Tanker", flag: "🇲🇭", origin: "Batam", originCode: "BTM", destination: "Pasir Panjang", destinationCode: "SGP", progress: 34, status: "Delayed", departure: "15:05 SGT", scheduled: "17:10 SGT", estimated: "17:45 SGT", currentLocation: "Singapore Strait / 01°10′N 104°02′E", stops: "Batam anchorage" },
  { id: "ever-meridian", fleet: "fleet-2", name: "Ever Meridian", type: "Container Ship", flag: "🇸🇬", origin: "Laem Chabang", originCode: "LCH", destination: "Tuas", destinationCode: "SGT", progress: 81, status: "At Berth", departure: "07:15 SGT", scheduled: "15:30 SGT", estimated: "15:30 SGT", currentLocation: "Tuas Port / B6", stops: "None" },
  { id: "strait-pioneer", fleet: "fleet-3", name: "Strait Pioneer", type: "Feeder Vessel", flag: "🇭🇰", origin: "Jakarta", originCode: "JKT", destination: "Tuas", destinationCode: "SGT", progress: 46, status: "Fault Alert", departure: "11:30 SGT", scheduled: "19:05 SGT", estimated: "Pending", currentLocation: "Riau approach / 01°03′N 104°12′E", stops: "Tanjung Priok" },
  { id: "sea-orchid", fleet: "fleet-3", name: "Sea Orchid", type: "Container Ship", flag: "🇨🇳", origin: "Ningbo", originCode: "NGB", destination: "Pasir Panjang", destinationCode: "SGP", progress: 63, status: "Traveling", departure: "03:20 SGT", scheduled: "20:40 SGT", estimated: "20:40 SGT", currentLocation: "South China Sea / 01°22′N 104°23′E", stops: "None" },
];

const decisionTierDetails: Record<DecisionTier, { label: string; short: string; description: string }> = {
  "1": { label: "Auto-execute", short: "Reversible safety actions", description: "Deterministic action inside a pre-authorized safety bound." },
  "2": { label: "Execute + notify", short: "Low-risk coordination", description: "The system acts and sends a visible operator notice." },
  "3": { label: "Human approval", short: "Material trade-off", description: "A duty manager must choose and commit the recovery path." },
};

const workforceTypes: { value: WorkforceType; label: string }[] = [
  { value: "nexus", label: "Crane failure / berth pressure" },
  { value: "squall", label: "Wind lockdown / safety response" },
  { value: "yard-surge", label: "Yard occupancy surge" },
];
const workforceRecommendations: Record<WorkforceType, StaffingRecommendation[]> = {
  nexus: [
    { id: "nexus-yard-balance", type: "nexus", label: "Rebalance yard connection window", from: "Block C", to: "Block F", headcount: 6, duration: "3 hours", fromLoad: "82%", toLoad: "64%", confidence: "86%", rationale: "Crane #4 fault and B3 convergence create a short-lived connection-window gap in Block F.", affectedShift: "Swing shift · 16:00–19:00 SGT" },
    { id: "nexus-quay-support", type: "nexus", label: "Reinforce quay handover", from: "Block A", to: "Berth B3", headcount: 3, duration: "90 min", fromLoad: "58%", toLoad: "71%", confidence: "79%", rationale: "Move certified handover staff closer to the delayed vessel while the scheduler isolates the crane fault.", affectedShift: "Swing shift · 16:00–17:30 SGT" },
  ],
  squall: [
    { id: "squall-safety-marshal", type: "squall", label: "Reinforce wind safety perimeter", from: "Berth B7", to: "Berth B2", headcount: 4, duration: "2 hours", fromLoad: "44%", toLoad: "68%", confidence: "91%", rationale: "Redirect safety marshals toward the exposed western berth as the 55-knot threshold is approached.", affectedShift: "Weather watch · next 2 hours" },
    { id: "squall-yard-shelter", type: "squall", label: "Stage sheltered yard response", from: "Block D", to: "Block H", headcount: 5, duration: "3 hours", fromLoad: "52%", toLoad: "76%", confidence: "83%", rationale: "Move frontline coordinators to the sheltered block before the circuit breaker closes exposed crane lanes.", affectedShift: "Night shift · 22:00–01:00 SGT" },
  ],
  "yard-surge": [
    { id: "yard-surge-connection", type: "yard-surge", label: "Relieve export stack pressure", from: "Block C", to: "Block F", headcount: 8, duration: "4 hours", fromLoad: "91%", toLoad: "63%", confidence: "88%", rationale: "Occupancy sync shows a concentrated export stack; additional coordinators can clear the next truck connection window.", affectedShift: "Day shift · 08:00–12:00 SGT" },
    { id: "yard-surge-gate", type: "yard-surge", label: "Open secondary gate flow", from: "Block E", to: "Gate 4", headcount: 4, duration: "2 hours", fromLoad: "73%", toLoad: "58%", confidence: "76%", rationale: "Shift dispatch staff to the secondary gate to absorb a short queue without disturbing crane coverage.", affectedShift: "Day shift · next 2 hours" },
  ],
};
const initialWorkforceHistory: ApprovalHistoryRow[] = [];

const baseLogs: LogEntry[] = [
  { time: "23:09:02", title: "AGV fleet health check passed", body: "14 units reporting nominal battery, route, and safety telemetry." },
  { time: "23:06:41", title: "Weather check: nominal", body: "Southwest cell activity remains below watch threshold." },
  { time: "23:04:12", title: "Routine berth handover", body: "B6 → B7 coordination acknowledged by terminal control." },
  { time: "23:02:28", title: "Yard occupancy sync completed", body: "Zone 2 at 78.4% — below soft capacity threshold." },
  { time: "22:59:46", title: "Equipment telemetry heartbeat", body: "17 of 18 quay cranes reporting healthy state." },
  { time: "22:57:13", title: "Policy engine heartbeat", body: "All decision gates responding within 120 ms." },
];

const nexusSteps = [
  ["Vessel ETA shift", "Malacca Strait congestion → B3 timeline", "Awaiting"],
  ["Quay Crane #4 fault", "Hydraulic telemetry reports failure", "Awaiting"],
  ["Crane #7 timeout", "Retry → fallback to cached state", "Awaiting"],
  ["Policy engine trace", "SLA breach + human approval gate", "Awaiting"],
  ["Duty manager review", "Compare recovery options", "Awaiting"],
  ["Cross-system execution", "TOS · Scheduler · Yard · MPA", "Awaiting"],
] as const;

const squallSteps = [
  ["Convective cell detected", "Rapid development southwest of Tuas", "Awaiting"],
  ["Wind-state projections", "Projecting 1,000+ digital-twin states", "Awaiting"],
  ["Threshold breached", "62 kt projected > 55 kt safety limit", "Awaiting"],
  ["Circuit breaker armed", "Pre-authorized Tier 1/2 protocol", "Awaiting"],
  ["Lockdown sequence", "Pins · AGVs · revised berth ETAs", "Awaiting"],
  ["All-clear + audit", "Resume operations and record outcome", "Awaiting"],
] as const;

const initialAudit: AuditRow[] = [
  { time: "13:42:08", event: "Bunching forecast — 3 ETAs converged", tier: "Tier 2", decision: "Berth smoothing recommended", operator: "auto", status: "Auto-executed", hash: "AUD-8838-BU" },
  { time: "12:18:44", event: "Yard Zone 2 reached soft capacity", tier: "Tier 2", decision: "Rebalance 6 blocks", operator: "auto", status: "Auto-executed", hash: "AUD-8837-YD" },
  { time: "11:04:19", event: "Chassis availability below target", tier: "Tier 3", decision: "Hold for shift lead", operator: "D. Lim", status: "Approved", hash: "AUD-8836-CH" },
  { time: "09:52:36", event: "Wind projection exceeded threshold", tier: "Tier 1", decision: "Circuit breaker armed", operator: "auto", status: "Resolved", hash: "AUD-8835-WX" },
  { time: "08:27:51", event: "AGV-14 route conflict detected", tier: "Tier 1", decision: "Rerouted to safe lane", operator: "auto", status: "Resolved", hash: "AUD-8834-AG" },
];

function nowTime() {
  return new Date().toLocaleTimeString("en-GB", { hour12: false });
}

function useWeatherRadar() {
  const [radar, setRadar] = useState<RadarState>({ status: "loading" });
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch("https://api-open.data.gov.sg/v2/real-time/api/weather-radar-images/70km", { headers: { Accept: "application/json" } });
        if (!response.ok) throw new Error(`Radar request failed (${response.status})`);
        const payload = await response.json() as RadarApiResponse;
        const record = payload.data?.records?.[0];
        if (!record?.image?.url) throw new Error(payload.errorMsg || "No current radar image returned");
        if (!cancelled) setRadar({ status: "live", imageUrl: record.image.url, capturedAt: record.timestamp, updatedAt: record.updatedTimestamp, label: record.image.label, range: record.image.range });
      } catch (error) {
        if (!cancelled) setRadar((current) => ({ ...current, status: "fallback", error: error instanceof Error ? error.message : "Radar unavailable" }));
      }
    };
    load();
    const id = window.setInterval(load, 300000);
    return () => { cancelled = true; window.clearInterval(id); };
  }, []);
  return radar;
}

function formatRadarTime(timestamp?: string) {
  if (!timestamp) return "—";
  return new Date(timestamp).toLocaleTimeString("en-SG", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function useAnimatedConfidence(target: number) {
  const [value, setValue] = useState(target);
  useEffect(() => {
    const start = value;
    const distance = target - start;
    if (Math.abs(distance) < 0.1) return;
    const started = performance.now();
    const duration = 950;
    let raf = 0;
    const tick = (time: number) => {
      const progress = Math.min(1, (time - started) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round((start + distance * eased) * 10) / 10);
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // We intentionally respond to target only; the in-flight value should not restart the tween.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);
  return value;
}

export default function Home() {
  const [activeView, setActiveView] = useState<ViewId>("command");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [railCollapsed, setRailCollapsed] = useState(false);
  const [clock, setClock] = useState(nowTime);
  const [scenario, setScenario] = useState<ScenarioId>("nexus");
  const [decisionTier, setDecisionTier] = useState<DecisionTier>("3");
  const radar = useWeatherRadar();
  const [mapLayer, setMapLayer] = useState<MapLayer>("berths");
  const [fleetTab, setFleetTab] = useState<string>("fleet-1");
  const [fleetOpen, setFleetOpen] = useState(true);
  const [selectedVesselId, setSelectedVesselId] = useState<string | null>(null);
  const [scenarioStatus, setScenarioStatus] = useState<ScenarioStatus>("idle");
  const [scenarioStep, setScenarioStep] = useState(0);
  const [confidenceTarget, setConfidenceTarget] = useState(98);
  const confidence = useAnimatedConfidence(confidenceTarget);
  const [logs, setLogs] = useState<LogEntry[]>(baseLogs);
  const [audit, setAudit] = useState<AuditRow[]>(initialAudit);
  const [selectedOption, setSelectedOption] = useState("B");
  const [countdown, setCountdown] = useState(45);
  const [execution, setExecution] = useState<string[]>([]);
  const [workforceApproved, setWorkforceApproved] = useState(false);
  const [workforceType, setWorkforceType] = useState<WorkforceType>("nexus");
  const [workforceRecommendationId, setWorkforceRecommendationId] = useState("nexus-yard-balance");
  const [workforceHistory, setWorkforceHistory] = useState<ApprovalHistoryRow[]>(initialWorkforceHistory);
  const [historyOpen, setHistoryOpen] = useState(false);
  const ambientIndex = useRef(0);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const id = window.setInterval(() => setClock(nowTime()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (scenarioStatus !== "lockdown") return;
    const id = window.setInterval(() => setCountdown((current) => Math.max(0, current - 3)), 1000);
    return () => window.clearInterval(id);
  }, [scenarioStatus]);

  useEffect(() => {
    if (scenarioStatus !== "idle") return;
    const ambient = [
      ["Live feed heartbeat", "AIS, yard, and equipment sources are responding within tolerance."],
      ["Routine berth handover", "B7 → B8 coordination acknowledged by terminal control."],
      ["Weather check: nominal", "No active convective cells inside the Tuas watch radius."],
    ] as const;
    const id = window.setInterval(() => {
      const item = ambient[ambientIndex.current % ambient.length];
      ambientIndex.current += 1;
      addLog(item[0], item[1]);
    }, 8000);
    return () => window.clearInterval(id);
  }, [scenarioStatus]);

  useEffect(() => {
    if (scenarioStatus !== "resolved") return;
    const id = window.setTimeout(() => {
      clearTimers();
      setScenarioStatus("idle");
      setScenarioStep(0);
      setConfidenceTarget(98);
      setCountdown(45);
      setExecution([]);
      setWorkforceApproved(false);
      addLog("Monitoring state restored", "No active incidents — live feeds nominal.", "resolved");
    }, 4200);
    return () => window.clearTimeout(id);
  }, [scenarioStatus]);

  useEffect(() => {
    if (scenarioStatus !== "lockdown" || countdown > 0) return;
    setScenarioStatus("resolved");
    setScenarioStep(6);
    setExecution(["RMC-12 pins unlocked", "RMC-13 pins unlocked", "RMC-14 pins unlocked", "AGV fleet resumed", "Berth ETAs reconciled"]);
    addLog("All-clear detected — wind speeds below threshold", "Pins unlocked, AGVs resumed, and affected lines reconciled.", "resolved");
    addAudit({ time: nowTime(), event: "Sumatra Squall — Micro-Climate Lockdown", tier: "Tier 1/2", decision: "Circuit breaker auto-executed", operator: "auto", status: "Resolved", hash: "AUD-8842-WX" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdown, scenarioStatus]);

  function addLog(title: string, body: string, tone?: LogEntry["tone"]) {
    setLogs((current) => [{ time: nowTime(), title, body, tone }, ...current].slice(0, 9));
  }

  function addAudit(row: AuditRow) {
    setAudit((current) => [row, ...current]);
  }

  function clearTimers() {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current = [];
  }

  function resetScenario() {
    clearTimers();
    setScenarioStatus("idle");
    setScenarioStep(0);
    setConfidenceTarget(98);
    setCountdown(45);
    setExecution([]);
    setWorkforceApproved(false);
    addLog("Monitoring state refreshed", `${scenario === "nexus" ? "Vessel and equipment" : "Weather and safety"} feeds returned to baseline.`);
  }

  function runScenario(scenarioToRun: ScenarioId = scenario) {
    if (scenarioStatus === "running" || scenarioStatus === "approval" || scenarioStatus === "executing" || scenarioStatus === "lockdown") return;
    clearTimers();
    setScenario(scenarioToRun);
    setScenarioStatus("running");
    setScenarioStep(0);
    setExecution([]);
    setWorkforceApproved(false);
    setConfidenceTarget(98);
    const run = (delay: number, action: () => void) => {
      timers.current.push(window.setTimeout(action, delay));
    };
    if (scenarioToRun === "nexus") {
      run(1000, () => {
        setScenarioStep(1);
        addLog("AIS feed: MSC Anna ETA revised +90 min", "Malacca Strait congestion detected — B3 berth timeline updated.", "warning");
      });
      run(2350, () => {
        setScenarioStep(2);
        setConfidenceTarget(84);
        addLog("Equipment alert: Quay Crane #4", "Hydraulic pressure fault detected — scheduler checking adjacent capacity.", "critical");
      });
      run(3700, () => {
        setScenarioStep(3);
        setConfidenceTarget(67);
        addLog("Telemetry: Crane #7 connection timeout", "Retrying… fallback to cached state. Confidence: 84% → 67%.", "warning");
      });
      run(5250, () => {
        setScenarioStep(4);
        setScenarioStatus("approval");
        addLog("Policy Engine: Tier 3 escalation", "SLA breach risk HIGH + degraded confidence — human approval required.", "warning");
      });
    } else {
      run(950, () => {
        setScenarioStep(1);
        addLog("Meteorological radar: squall forming", "Rapid convective development detected southwest of Tuas — ETA 28 min.", "warning");
      });
      run(2150, () => {
        setScenarioStep(2);
        addLog("Digital twin: 1,247 wind states projected", "Projection window covers the next 45 minutes around Tuas.");
      });
      run(3600, () => {
        setScenarioStep(3);
        setConfidenceTarget(95);
        addLog("Safety signal: sustained wind projection at 62 knots", "55-knot crane safety limit exceeded — Instant Circuit Breaker ARMED.", "critical");
      });
      run(5000, () => {
        setScenarioStep(4);
        addLog("Safety protocol auto-executing", "Anti-typhoon pins, AGV safe zones, and revised berth ETAs in motion.", "warning");
      });
      run(6350, () => {
        setScenarioStep(5);
        setScenarioStatus("lockdown");
        setCountdown(45);
        setExecution(["RMC-12 pins locked", "RMC-13 pins locked", "RMC-14 pins locked", "14 AGVs rerouted", "3 shipping lines notified"]);
        addLog("Instant Circuit Breaker armed", "Lockdown active for an estimated 45 min — pre-authorized safety protocol.", "warning");
      });
    }
  }

  function selectVessel(vesselId: string) {
    setSelectedVesselId(vesselId);
    setFleetOpen(false);
  }

  function inspectVessel(vesselId: string) {
    const vessel = vessels.find((item) => item.id === vesselId);
    if (!vessel) return;
    selectVessel(vesselId);
    addLog("Vessel detail opened", `${vessel.name} / ${vessel.originCode} → ${vessel.destinationCode} / live route context loaded.`);
    if (vesselId === "msc-anna" && scenarioStatus === "idle") {
      addLog("AIS detail refresh requested", "Awaiting the next live position and ETA signal from MSC Anna.");
      timers.current.push(window.setTimeout(() => runScenario("nexus"), 1200));
    }
  }

  function changeDecisionTier(tier: DecisionTier) {
    setDecisionTier(tier);
    const detail = decisionTierDetails[tier];
    addLog("Operator decision tier selected", `${detail.label} — ${detail.description}`);
  }

  function startIncident(kind: ScenarioId) {
    if (scenarioStatus !== "idle") return;
    setScenario(kind);
    setDecisionTier(kind === "nexus" ? "3" : "1");
    setWorkforceType(kind);
    setWorkforceRecommendationId(workforceRecommendations[kind][0].id);
    setWorkforceApproved(false);
    if (kind === "nexus") setSelectedVesselId("msc-anna");
    setActiveView("simulator");
    addLog(kind === "nexus" ? "Live feed refresh requested" : "Weather radar inspection requested", kind === "nexus" ? "Opening MSC Anna detail — awaiting a fresh AIS signal." : "Opening southwest weather cell detail — evaluating current conditions.");
    timers.current.push(window.setTimeout(() => runScenario(kind), 1100));
  }

  function approveRecovery() {
    clearTimers();
    setScenarioStatus("executing");
    setScenarioStep(5);
    setConfidenceTarget(95);
    setExecution([]);
    addLog(`Option ${selectedOption} approved by Ops Duty Manager`, "Recovery path authorized — cross-system execution trace opened.");
    const systems = ["TOS updated", "Crane Scheduler updated", "Yard Manager rebalanced", "MPA notification sent"];
    systems.forEach((system, index) => {
      timers.current.push(window.setTimeout(() => setExecution((current) => [...current, system]), 520 + index * 570));
    });
    timers.current.push(window.setTimeout(() => {
      setScenarioStatus("resolved");
      setScenarioStep(6);
      addLog("Recovery committed: B3 berth state restored", "Cross-system execution complete — confidence recovered to 95%.", "resolved");
      addAudit({ time: nowTime(), event: "Singapore Nexus Disruption", tier: "Tier 3", decision: `Option ${selectedOption} approved + executed`, operator: "Ops Duty Manager", status: "Resolved", hash: "AUD-8841-B3" });
    }, 2850));
  }

  function rejectRecovery() {
    clearTimers();
    setScenarioStatus("idle");
    setScenarioStep(0);
    setConfidenceTarget(98);
    setCountdown(45);
    setExecution([]);
    setWorkforceApproved(false);
    addLog(`Option ${selectedOption} rejected by Ops Duty Manager`, "No cross-system changes committed — returning MSC Anna to live monitoring.", "warning");
    addAudit({ time: nowTime(), event: "Singapore Nexus Disruption", tier: "Tier 3", decision: `Option ${selectedOption} rejected`, operator: "Ops Duty Manager", status: "Rejected", hash: `AUD-${Date.now().toString().slice(-6)}-RJ` });
  }

  function updateWorkforceType(type: WorkforceType) {
    setWorkforceType(type);
    setWorkforceRecommendationId(workforceRecommendations[type][0].id);
    setWorkforceApproved(false);
  }

  function updateWorkforceRecommendation(id: string) {
    setWorkforceRecommendationId(id);
    setWorkforceApproved(false);
  }

  function approveWorkforce() {
    if (workforceApproved) return;
    const recommendation = workforceRecommendations[workforceType].find((item) => item.id === workforceRecommendationId) ?? workforceRecommendations[workforceType][0];
    setWorkforceApproved(true);
    addLog("Workforce plan approved", `${recommendation.headcount} yard staff reassigned from ${recommendation.from} to ${recommendation.to} for ${recommendation.duration}.`, "resolved");
    addAudit({ time: nowTime(), event: "Frontline Workforce Load-Balancing", tier: "Tier 3", decision: "Operator approved shift reallocation", operator: "Ops Duty Manager", status: "Approved", hash: `AUD-4410-WF-${workforceHistory.length + 1}` });
    setWorkforceHistory((current) => [{ id: `WF-${Date.now()}`, time: nowTime(), recommendation: `${recommendation.headcount} staff · ${recommendation.from} → ${recommendation.to}`, affectedShift: recommendation.affectedShift, operator: "Ops Duty Manager", status: "Approved" }, ...current]);
  }

  function setView(view: ViewId) {
    setActiveView(view);
    setMobileOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const scenarioSteps = scenario === "nexus" ? nexusSteps : squallSteps;
  const progress = Math.round((scenarioStep / 6) * 100);
  const confidenceTone: SignalTone = confidence < 75 ? "amber" : confidence >= 94 ? "green" : "teal";
  const vessels = useMemo(() => vesselData.map((vessel) => vessel.id === "msc-anna" && scenario === "nexus" && scenarioStatus !== "idle" ? { ...vessel, status: "Delayed" as VesselStatus, estimated: scenarioStep >= 1 ? "17:30 SGT" : vessel.estimated } : vessel), [scenario, scenarioStatus, scenarioStep]);
  const workforceRecommendation = workforceRecommendations[workforceType].find((item) => item.id === workforceRecommendationId) ?? workforceRecommendations[workforceType][0];

  return (
    <div className={`app-shell ${railCollapsed ? "rail-collapsed" : ""}`}>
      <aside className={`app-rail ${mobileOpen ? "mobile-open" : ""} ${railCollapsed ? "collapsed" : ""}`}>
        <button className="rail-collapse-control" onClick={() => setRailCollapsed((collapsed) => !collapsed)} aria-label={railCollapsed ? "Expand sidebar" : "Collapse sidebar"} title={railCollapsed ? "Expand sidebar" : "Collapse sidebar"}>{railCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}<span>{railCollapsed ? "Expand" : "Collapse"}</span></button>
        <div className="brand-lockup">
          <img src="/manus-storage/portwatch-tuas-beacon-mark_a1790bef.png" alt="Portwatch beacon mark" />
          <div className="brand-name">PORTWATCH<small>TUAS / SG</small></div>
        </div>
        <div className="rail-eyebrow">Portwatch command layer</div>
        <nav className="rail-nav" aria-label="Primary navigation">
          {navItems.map((item) => (
            <RailButton key={item.id} active={activeView === item.id} icon={item.icon} label={item.label} badge={item.badge} onClick={() => setView(item.id)} />
          ))}
        </nav>
        <div className="rail-foot">
          <div className="rail-status"><span className="status-dot pulse" />All systems nominal</div>
          <strong>PORTWATCH / TUAS</strong><br />Operator workspace · illustrative state
        </div>
      </aside>

      <div className="content-shell">
        <header className="topbar">
          <div className="topbar-identity"><button className="icon-button mobile-rail-toggle" onClick={() => setMobileOpen((open) => !open)} aria-label="Open navigation">{mobileOpen ? <X size={15} /> : <Menu size={15} />}</button><img src="/manus-storage/portwatch-tuas-beacon-mark_a1790bef.png" alt="" /><span>PORTWATCH<small>TUAS</small></span><div className="breadcrumb"><ChevronRight size={12} /><strong>{navItems.find((item) => item.id === activeView)?.label}</strong></div></div>
          <div className="topbar-actions"><div className="state-readout"><span className="status-dot pulse" />B3 / 16:00 WINDOW · 14 TRACKED</div><div className="live-chip"><span className="status-dot pulse" />Live feed connected</div><span className="topbar-time">SGT {clock}</span><button className="icon-button" onClick={() => addLog("System snapshot captured", "Current operational state copied to the local event feed.")} aria-label="Capture system snapshot"><ScanLine size={15} /></button></div>
        </header>

        <main className="page-body">
          <div className="view-status-row"><StatusPill tone={scenarioStatus === "resolved" ? "green" : scenarioStatus === "approval" ? "amber" : "teal"} pulse={scenarioStatus === "idle"}>{scenarioStatus === "idle" ? "Monitoring — no active incidents" : scenarioStatus === "resolved" ? "Incident resolved" : scenarioStatus === "approval" ? "Approval required" : "Live incident detected"}</StatusPill><span className="topbar-time">UPDATED {clock} SGT</span></div>

          {activeView === "command" && <InboxDashboard scenarioStatus={scenarioStatus} onOpenIncident={startIncident} workforceType={workforceType} workforceRecommendationId={workforceRecommendationId} workforceRecommendation={workforceRecommendation} workforceApproved={workforceApproved} workforceHistory={workforceHistory} historyOpen={historyOpen} onWorkforceTypeChange={updateWorkforceType} onWorkforceRecommendationChange={updateWorkforceRecommendation} onApproveWorkforce={approveWorkforce} onToggleWorkforceHistory={() => setHistoryOpen((open) => !open)} />}
          {activeView === "simulator" && <IncidentCenter scenario={scenario} status={scenarioStatus} confidence={confidence} confidenceTone={confidenceTone} selectedOption={selectedOption} setSelectedOption={setSelectedOption} approveRecovery={approveRecovery} rejectRecovery={rejectRecovery} onOpenIncident={startIncident} />}
          {activeView === "audit" && <SimpleAuditView audit={audit} />}
        </main>
      </div>
    </div>
  );
}

function InboxDashboard({ scenarioStatus, onOpenIncident, workforceType, workforceRecommendationId, workforceRecommendation, workforceApproved, workforceHistory, historyOpen, onWorkforceTypeChange, onWorkforceRecommendationChange, onApproveWorkforce, onToggleWorkforceHistory }: { scenarioStatus: ScenarioStatus; onOpenIncident: (kind: ScenarioId) => void; workforceType: WorkforceType; workforceRecommendationId: string; workforceRecommendation: StaffingRecommendation; workforceApproved: boolean; workforceHistory: ApprovalHistoryRow[]; historyOpen: boolean; onWorkforceTypeChange: (type: WorkforceType) => void; onWorkforceRecommendationChange: (id: string) => void; onApproveWorkforce: () => void; onToggleWorkforceHistory: () => void }) {
  const incidentOpen = scenarioStatus !== "idle" && scenarioStatus !== "resolved";
  return <div className="inbox-dashboard">
    <div className="dashboard-intro"><div><div className="eyebrow">TUAS PORT / OPERATIONS HOME</div><h1>Keep B3 moving under review.</h1><p>One vessel delay is coupled to a crane fault and yard pressure. Review the decision, then let the rest of the port keep moving.</p></div><div className="dashboard-health"><span className="status-dot pulse" />{incidentOpen ? "Response in progress" : "Port operating normally"}<small>Last sync just now</small></div></div>
    <div className="inbox-layout">
      <Panel className="port-status-panel" accent><div className="simple-panel-heading"><div><div className="eyebrow">LIVE PORT STATUS</div><h2>Tuas Port</h2><p>Berths B1–B5 · current operating window</p></div><StatusPill tone="teal" pulse>5 berths monitored</StatusPill></div><div className="berth-map"><div className="berth-map-water"><div className="water-label">WESTERN APPROACH</div><div className="route-line" /><div className="ship-chip"><Ship size={13} />MSC Anna</div></div><div className="berth-list">{["B1", "B2", "B3", "B4", "B5"].map((berth) => <button key={berth} className={`berth-row ${berth === "B3" ? "incident" : ""}`} onClick={() => berth === "B3" && onOpenIncident("nexus")}><span className="berth-code">{berth}</span><span className="berth-name">{berth === "B3" ? "MSC Anna · vessel delay" : berth === "B1" ? "Ever Meridian · on plan" : berth === "B2" ? "Available window" : berth === "B4" ? "Crane coverage nominal" : "Available window"}</span><span className={`berth-state ${berth === "B3" ? "warn" : "ok"}`}>{berth === "B3" ? "Needs review" : "On plan"}</span><ArrowRight size={14} /></button>)}</div></div><div className="map-footnote"><MapPin size={13} />Click B3 to open the active incident</div></Panel>
      <div className="inbox-column"><ActiveDisruptionInbox onOpenIncident={onOpenIncident} scenarioStatus={scenarioStatus} /><WorkforceModule scenarioStatus={scenarioStatus} type={workforceType} recommendationId={workforceRecommendationId} recommendation={workforceRecommendation} approved={workforceApproved} historyCount={workforceHistory.length} onTypeChange={onWorkforceTypeChange} onRecommendationChange={onWorkforceRecommendationChange} onApprove={onApproveWorkforce} onToggleHistory={onToggleWorkforceHistory} />{historyOpen && <ApprovalHistoryDrawer rows={workforceHistory} onClose={onToggleWorkforceHistory} />}</div>
    </div>
    <div className="quick-stats"><div><span>Yard utilization</span><strong>78.4%</strong><small>Within operating range</small></div><div><span>Vessels tracked</span><strong>14</strong><small>3 arrivals need attention</small></div><div><span>Equipment health</span><strong>17 / 18</strong><small>One telemetry timeout</small></div><div><span>Operator queue</span><strong>{scenarioOpenLabel(scenarioStatus)}</strong><small>Human decisions only</small></div></div>
  </div>;
}

function scenarioOpenLabel(status: ScenarioStatus) {
  if (status === "approval") return "1 open";
  if (status === "executing") return "Executing";
  if (status === "resolved") return "Clear";
  return "1 watch";
}

function ActiveDisruptionInbox({ onOpenIncident, scenarioStatus }: { onOpenIncident: (kind: ScenarioId) => void; scenarioStatus: ScenarioStatus }) {
  return <Panel className="active-inbox" accent><div className="simple-panel-heading"><div><div className="eyebrow">ACTION CENTER</div><h2>Active disruption inbox</h2><p>Two signals are being watched. One needs your decision.</p></div><span className="inbox-count">2</span></div><div className="inbox-list"><button className={`inbox-item ${scenarioStatus === "approval" ? "selected" : ""}`} onClick={() => onOpenIncident("nexus")}><span className="inbox-icon critical"><TriangleAlert size={16} /></span><span className="inbox-copy"><strong>Crane #4 hydraulic failure</strong><small>MSC Anna delayed by 90 min · Berth B3</small><em>Human approval required</em></span><ArrowRight size={16} /></button><button className="inbox-item" onClick={() => onOpenIncident("squall")}><span className="inbox-icon caution"><Wind size={16} /></span><span className="inbox-copy"><strong>Weather watch near Tuas</strong><small>Wind projection at 62 kt · south-west cell</small><em className="safe">Auto-protection ready</em></span><ArrowRight size={16} /></button></div><div className="inbox-footer"><span><span className="status-dot red" />1 decision waiting</span><span>Updated just now</span></div></Panel>;
}

function IncidentCenter({ scenario, status, confidence, confidenceTone, selectedOption, setSelectedOption, approveRecovery, rejectRecovery, onOpenIncident }: { scenario: ScenarioId; status: ScenarioStatus; confidence: number; confidenceTone: SignalTone; selectedOption: string; setSelectedOption: (option: string) => void; approveRecovery: () => void; rejectRecovery: () => void; onOpenIncident: (kind: ScenarioId) => void }) {
  const isNexus = scenario === "nexus";
  const isApproval = status === "approval";
  const isResolved = status === "resolved";
  const options = [{ id: "A", title: "Re-sequence berth window", tradeoff: "Fastest recovery · 55 min delay · higher SLA risk" }, { id: "B", title: "Split discharge to C5 / C8", tradeoff: "Balanced recovery · 42 min delay · +$18k handling cost" }, { id: "C", title: "Hold and reassess", tradeoff: "Lowest change · vessel delay extends beyond 90 min" }];
  if (!isNexus) return <div className="incident-center"><div className="incident-topline"><div><div className="eyebrow">ACTIVE INCIDENTS / WEATHER</div><h1>Weather safety watch</h1><p>Pre-authorized safety actions are ready while the south-west cell approaches Tuas.</p></div><button className="text-button" onClick={() => onOpenIncident("nexus")}>View vessel incident <ArrowRight size={14} /></button></div><Panel className="weather-simple" accent><div className="weather-simple-icon"><Wind size={28} /></div><div><StatusPill tone={isResolved ? "green" : "amber"}>{isResolved ? "Resolved" : "Tier 1/2 · auto-protection"}</StatusPill><h2>62 kt projected wind</h2><p>Anti-typhoon pins and safe AGV zones will activate automatically if the 55 kt threshold is crossed.</p></div><div className="weather-readout"><strong>28 min</strong><span>estimated arrival</span></div></Panel></div>;
  return <div className="incident-center"><div className="incident-topline"><div><div className="eyebrow">ACTIVE INCIDENTS / VESSEL + EQUIPMENT</div><h1>One decision needs your attention.</h1><p>Portwatch has correlated the vessel delay, crane failure, yard pressure, and a telemetry timeout.</p></div><StatusPill tone={isResolved ? "green" : isApproval ? "red" : "amber"}>{isResolved ? "Resolved" : isApproval ? "Tier 3 · approval required" : "Investigating"}</StatusPill></div><div className="uncertainty-banner"><CircleAlert size={17} /><div><strong>Tool Timeout: Falling back to cached state.</strong><span>Crane #7 telemetry did not respond. Confidence reduced to {confidence}%.</span></div><span className="confidence-mini">{confidence}%</span></div><Panel className="action-card" accent><div className="action-card-header"><div><div className="eyebrow">HUMAN-IN-THE-LOOP ACTION</div><h2>Should we commit the B3 recovery plan?</h2><p><strong>Situation summary:</strong> MSC Anna is delayed by 90 mins, Crane #4 has failed, and Yard Block C7 is at 91% capacity.</p></div><SignalTag label="Tier 3 · Human approval required" tone="red" icon="alert" /></div><div className="recommendation-label">AI recommendations <span>Choose one path. The system will not commit until you approve.</span></div><div className="recommendation-list">{options.map((option) => <button key={option.id} className={`recommendation ${selectedOption === option.id ? "selected" : ""}`} onClick={() => setSelectedOption(option.id)} aria-pressed={selectedOption === option.id}><span className="recommendation-radio">{selectedOption === option.id ? <Check size={13} /> : option.id}</span><span><strong>Option {option.id} · {option.title}</strong><small>{option.tradeoff}</small></span>{option.id === "B" && <span className="recommended-label">Recommended</span>}</button>)}</div><div className="action-footer"><div className="action-note"><ShieldCheck size={15} /><span>Operator decision is recorded in the audit trail.<small>Confidence is below the auto-execution threshold.</small></span></div><div className="action-buttons"><button className="primary-action" onClick={approveRecovery} disabled={!isApproval || isResolved}><Check size={16} />Approve Option {selectedOption}</button><button className="secondary-action" onClick={rejectRecovery} disabled={isResolved}>Modify / Reject</button></div></div></Panel><div className="incident-side-note"><Info size={15} /><span>{isApproval ? "Review the trade-off, then approve a recovery path." : isResolved ? "Recovery committed and logged. The port is back in monitoring mode." : "The agent is correlating live signals. Approval controls will appear when the policy gate is reached."}</span></div></div>;
}

function SimpleAuditView({ audit }: { audit: AuditRow[] }) {
  const steps = [{ label: "Detect", detail: "AIS and equipment feeds surfaced a change", icon: Radio }, { label: "Correlate", detail: "Vessel delay matched to Crane #4 and yard C7", icon: GitBranch }, { label: "Analyze", detail: "Three recovery paths scored for time and cost", icon: BrainCircuit }, { label: "Policy check", detail: "Tier 3 boundary confirmed because SLA risk is material", icon: ShieldCheck }, { label: "Escalated / executed", detail: "Duty manager decision recorded and systems updated", icon: CheckCircle2 }];
  return <div className="audit-simple"><div className="audit-simple-heading"><div><div className="eyebrow">AUDIT TRAIL</div><h1>What the agent did</h1><p>A plain-English record of detection, reasoning, approval, and execution.</p></div><StatusPill tone="teal">{audit.length} events recorded</StatusPill></div><Panel className="execution-timeline" accent>{steps.map((step, index) => { const Icon = step.icon; return <div className="timeline-step" key={step.label}><div className={`timeline-icon ${index < 4 ? "complete" : "pending"}`}><Icon size={16} /></div><div className="timeline-copy"><strong>{step.label}</strong><span>{step.detail}</span><small>{index === 4 ? "Waiting for the next operator decision" : index === 3 ? "Latest incident · 23:09 SGT" : `${index + 1} min ago`}</small></div>{index < steps.length - 1 && <div className="timeline-line" />}</div>; })}</Panel><div className="audit-recent"><div className="eyebrow">RECENT DECISIONS</div>{audit.slice(0, 4).map((row, index) => <div className="audit-recent-row" key={`${row.hash}-${index}`}><span>{row.time}</span><strong>{row.event}</strong><span className="audit-decision">{row.decision}</span><StatusPill tone={row.status === "Resolved" ? "green" : row.status === "Approved" ? "amber" : "teal"}>{row.status}</StatusPill></div>)}</div></div>;
}

function SettingsView({ onReset }: { onReset: () => void }) {
  return <div className="settings-simple"><div className="eyebrow">WORKSPACE SETTINGS</div><h1>Settings</h1><p>Keep the demo focused on the signals and decisions that matter.</p><Panel className="settings-card"><div><h2>Operator workspace</h2><p>Local illustrative state is used for this hackathon preview. Resetting clears the active incident and returns the dashboard to monitoring.</p></div><button className="secondary-action" onClick={onReset}><RotateCcw size={15} />Reset monitoring state</button></Panel></div>;
}

function CommandCenter({ logs, confidence, confidenceTone, scenarioStatus, workforceType, workforceRecommendationId, workforceRecommendation, workforceApproved, workforceHistory, historyOpen, onWorkforceTypeChange, onWorkforceRecommendationChange, onApproveWorkforce, onToggleWorkforceHistory, mapLayer, onInspectVessel, onSelectVessel, onLayerChange, vessels, fleetTab, setFleetTab, fleetOpen, setFleetOpen, selectedVesselId, setSelectedVesselId }: { logs: LogEntry[]; confidence: number; confidenceTone: SignalTone; scenarioStatus: ScenarioStatus; workforceType: WorkforceType; workforceRecommendationId: string; workforceRecommendation: StaffingRecommendation; workforceApproved: boolean; workforceHistory: ApprovalHistoryRow[]; historyOpen: boolean; onWorkforceTypeChange: (type: WorkforceType) => void; onWorkforceRecommendationChange: (id: string) => void; onApproveWorkforce: () => void; onToggleWorkforceHistory: () => void; mapLayer: MapLayer; onInspectVessel: (vesselId: string) => void; onSelectVessel: (vesselId: string) => void; onLayerChange: (layer: MapLayer) => void; vessels: Vessel[]; fleetTab: string; setFleetTab: (tab: string) => void; fleetOpen: boolean; setFleetOpen: (open: boolean) => void; selectedVesselId: string | null; setSelectedVesselId: (id: string | null) => void }) {
  return (
    <div className="view-stack">
      <div className="kpi-strip">
        <MetricCard label="System confidence" value={confidence.toFixed(0)} suffix="%" delta="+2.6% / 24h" tone={confidenceTone} icon={Gauge} />
        <MetricCard label="Active disruptions" value="02" delta="1 needs review" tone="amber" icon={TriangleAlert} />
        <MetricCard label="Yard utilization" value="78.4" suffix="%" delta="−1.8% / 60m" tone="teal" icon={Boxes} />
        <MetricCard label="Vessels in approach" value="14" delta="3 bunching risk" tone="amber" icon={Ship} />
        <MetricCard label="Bunching risk" value="MED" delta="16:00 window" tone="amber" icon={Waves} />
        <MetricCard label="Equipment match" value="92.1" suffix="%" delta="+0.7% / 24h" tone="green" icon={Container} />
      </div>

      <div className="dashboard-grid">
        <VesselColumn vessels={vessels} fleetTab={fleetTab} setFleetTab={setFleetTab} fleetOpen={fleetOpen} setFleetOpen={setFleetOpen} selectedVesselId={selectedVesselId} setSelectedVesselId={setSelectedVesselId} onSelectVessel={onSelectVessel} />
        <div className="command-main">
          <Panel className={`map-panel ${mapLayer}-view`} accent>
            <div className="map-bg" />
            <div className="map-header"><div><div className="eyebrow">LIVE TWIN / WESTERN APPROACH</div><div className="map-title">{mapLayer === "berths" ? "Operational waters · 15 min horizon" : mapLayer === "yards" ? "Yard blocks · allocation pressure" : "Vessel routes · convergence vectors"}</div><div className="map-subtitle">{mapLayer === "berths" ? "01°16′N 103°38′E / 14 vessels tracked / 10 berth nodes" : mapLayer === "yards" ? "ZONE 02 / 78.4% occupied / 6 scarcity signals / 18 blocks" : "14 vessels tracked / 3 ETA vectors / 16:00–16:30 window"}</div></div><div className="map-toolbar"><button className={`map-tool ${mapLayer === "berths" ? "active" : ""}`} onClick={() => onLayerChange("berths")}>BERTHS</button><button className={`map-tool ${mapLayer === "yards" ? "active" : ""}`} onClick={() => onLayerChange("yards")}>YARDS</button><button className={`map-tool ${mapLayer === "routes" ? "active" : ""}`} onClick={() => onLayerChange("routes")}>ROUTES</button></div></div>
            <div className={`map-canvas ${mapLayer}-layer`}>
              {mapLayer !== "yards" && <div className="map-route" />}
              {mapLayer === "routes" && <><div className="map-route route-2" /><div className="map-route route-3" /><button className="vessel-marker vessel-one" onClick={() => onInspectVessel("msc-anna")}><Ship size={11} />MSC Anna</button><button className="vessel-marker vessel-two" onClick={() => onInspectVessel("mv-kestrel")}><Ship size={11} />MV Kestrel</button><button className="vessel-marker vessel-three" onClick={() => onInspectVessel("pacific-lark")}><Ship size={11} />Pacific Lark</button></>}
              {mapLayer === "yards" && <div className="yard-focus"><Boxes size={12} /><strong>YARD SCARCITY LAYER</strong><span>Zone 2 / 6 blocks under review</span></div>}
              <div className="map-annotation"><strong>{mapLayer === "berths" ? "CONVERGENCE WATCH" : mapLayer === "yards" ? "CAPACITY WATCH" : "ROUTE WATCH"}</strong>{mapLayer === "berths" ? "3 ETA vectors narrow inside the 16:00–16:30 berth window." : mapLayer === "yards" ? "C4–C7 are carrying the highest connection-window pressure." : "3 route vectors are narrowing on the same berth window."}</div>
              {mapLayer === "berths" && <button className="vessel-inspection" onClick={() => onInspectVessel("msc-anna")} aria-label="Inspect MSC Anna live signal"><Ship size={13} /><span><strong>MSC Anna</strong><small>inspect live AIS signal</small></span><ArrowDownRight size={12} /></button>}
              <PortCluster name="Tuas Port" code="TP / ZONE 02" className="tuas" nodes={["B1", "B2", "B3", "B4", "B5", "B6", "B7", "B8"]} selected="B3" />
              <PortCluster name="Pasir Panjang" code="PP / ZONE 04" className="pasir" nodes={["B9", "B10"]} />
            </div>
            <div className="map-legend"><span className="legend-item signal-teal"><i />Operational</span><span className="legend-item signal-amber"><i />Degraded</span><span className="legend-item signal-red"><i />Fault</span><span className="legend-coords">CLICK BERTH OR YARD BLOCK TO INSPECT</span></div>
            <CornerMark />
          </Panel>
          <div className="bunching-card"><div className="bunching-icon"><Waves size={16} /></div><div className="bunching-copy"><strong>Vessel bunching risk · MEDIUM</strong><p>90% of vessel arrivals are off schedule — convergence is the operational signal to watch, not the delay in isolation.</p></div><div className="risk-meter"><div className="risk-meter-bars"><span /><span /><span /></div><span className="risk-meter-label">3 / 5</span></div><div className="inspection-hint"><Radio size={13} />Inspect the <strong>MSC Anna</strong> signal on the map</div></div>
        </div>
        <EventLog logs={logs} />
        <div className="workforce-row">
          <WorkforceModule scenarioStatus={scenarioStatus} type={workforceType} recommendationId={workforceRecommendationId} recommendation={workforceRecommendation} approved={workforceApproved} historyCount={workforceHistory.length} onTypeChange={onWorkforceTypeChange} onRecommendationChange={onWorkforceRecommendationChange} onApprove={onApproveWorkforce} onToggleHistory={onToggleWorkforceHistory} />
          {historyOpen && <ApprovalHistoryDrawer rows={workforceHistory} onClose={onToggleWorkforceHistory} />}
        </div>
      </div>
    </div>
  );
}

function WorkforceModule({ scenarioStatus, type, recommendationId, recommendation, approved, historyCount, onTypeChange, onRecommendationChange, onApprove, onToggleHistory }: { scenarioStatus: ScenarioStatus; type: WorkforceType; recommendationId: string; recommendation: StaffingRecommendation; approved: boolean; historyCount: number; onTypeChange: (type: WorkforceType) => void; onRecommendationChange: (id: string) => void; onApprove: () => void; onToggleHistory: () => void }) {
  const activeSignal = scenarioStatus !== "idle" && scenarioStatus !== "resolved";
  const tone: SignalTone = approved ? "green" : activeSignal ? "amber" : "slate";
  const stateLabel = approved ? "Approved" : activeSignal ? "Recommendation ready" : "Standby / no active disruption";
  const [expanded, setExpanded] = useState(true);
  return <Panel className={`workforce-panel workforce-inbox-panel ${activeSignal ? "signal-active" : ""} ${approved ? "plan-approved" : ""}`}>
    <div className="workforce-header"><div><div className="eyebrow">HUMAN-IN-THE-LOOP / FRONTLINE CAPACITY</div><h3>Workforce load-balancing</h3></div><div className="workforce-header-actions"><StatusPill tone={tone} pulse={activeSignal && !approved}>● {stateLabel}</StatusPill><button className="history-toggle" onClick={onToggleHistory} aria-expanded={historyCount > 0}><FileClock size={12} />History{historyCount > 0 && <b>{historyCount.toString().padStart(2, "0")}</b>}</button></div></div>
    <div className="workforce-lead"><div className="workforce-icon"><UsersRound size={18} /></div><div><strong>{activeSignal || approved ? `Reassign ${recommendation.headcount} frontline staff` : "Labor routing on standby"}</strong><p>{activeSignal || approved ? `Move ${recommendation.headcount} staff from ${recommendation.from} to ${recommendation.to} for the next ${recommendation.duration}.` : "A disruption signal will surface a targeted shift recommendation here."}</p></div></div>
    <button className="workforce-expand" onClick={() => setExpanded((open) => !open)} aria-expanded={expanded}><span><span className="workforce-route"><b>{recommendation.from}</b><ArrowRight size={14} /><b>{recommendation.to}</b></span><small>{expanded ? "Hide recommendation details" : "Show recommendation details"}</small></span><span className="expand-mark">{expanded ? "−" : "+"}</span></button>
    {expanded && <div className="workforce-detail"><div className="workforce-rationale"><Info size={12} /><span>{recommendation.rationale}</span></div></div>}
    <div className="workforce-metrics"><div><span>Available</span><strong>18 staff</strong></div><div><span>Load shift</span><strong>{recommendation.fromLoad} → {recommendation.toLoad}</strong></div><div className="workforce-approval-note"><span>Operator approval required</span><strong>{recommendation.affectedShift}</strong></div></div>
    <div className="workforce-footer"><span><ShieldCheck size={12} />{approved ? "Reallocation approved" : "Operator approval required"} — {recommendation.affectedShift}</span><button className="workforce-approve" onClick={onApprove} disabled={!activeSignal || approved}>{approved ? "Approved" : activeSignal ? "Approve move" : "Awaiting signal"}</button></div>
  </Panel>;
}

function ApprovalHistoryDrawer({ rows, onClose }: { rows: ApprovalHistoryRow[]; onClose: () => void }) {
  return <section className="history-drawer" aria-label="Workforce approval history"><div className="history-drawer-header"><div><div className="eyebrow">Approval history / local state</div><h3>Workforce approvals</h3></div><button className="history-close" onClick={onClose} aria-label="Close workforce approval history"><X size={13} /></button></div>{rows.length === 0 ? <div className="history-empty"><FileClock size={16} /><span>No workforce approvals recorded in this session.</span></div> : <div className="history-list">{rows.map((row) => <div className="history-row" key={row.id}><span className="history-time">{row.time}</span><div><strong>{row.recommendation}</strong><span>{row.affectedShift} · {row.operator}</span></div><b>{row.status}</b></div>)}</div>}<CornerMark /></section>;
}

function PortCluster({ name, code, className, nodes, selected }: { name: string; code: string; className: string; nodes: string[]; selected?: string }) {
  return (
    <div className={`port-cluster ${className}`}>
      <div className="cluster-label"><span className="status-dot pulse" />{name}<span>{code}</span></div>
      <div className="cluster-body"><div className="yard-block yard-a"><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /></div><div className="yard-block yard-b"><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /></div><div className="cluster-berth" /><div className="cluster-berth" /><div className="cluster-berth" />{nodes.map((node, index) => <div key={node} className={`berth-node b${node.slice(1)} ${selected === node ? "selected" : ""}`}><i />{node}</div>)}</div>
    </div>
  );
}

function EventLog({ logs }: { logs: LogEntry[] }) {
  return <Panel className="log-panel"><div className="panel-header"><div><div className="eyebrow">Streaming / local state</div><h3>Event & Decision Log</h3></div><div className="log-header-actions"><span className="log-count">{logs.length.toString().padStart(2, "0")} EVENTS</span><Radio size={14} color="#78d9c5" /></div></div><div className="event-log">{logs.map((log, index) => <div className={`log-entry ${log.tone ?? ""}`} key={`${log.time}-${log.title}-${index}`}><span className="log-time">[{log.time}]</span><span className="log-line"><i /></span><div className="log-copy"><strong>{log.title}</strong>{log.body}</div></div>)}</div><div className="log-footer">AUTO-SCROLL ENABLED · RETAINING LAST 09 LOCAL EVENTS</div><CornerMark /></Panel>;
}

function statusClass(status: VesselStatus) {
  return status.toLowerCase().replace(/\s+/g, "-");
}

function VesselColumn({ vessels, fleetTab, setFleetTab, fleetOpen, setFleetOpen, selectedVesselId, setSelectedVesselId, onSelectVessel }: { vessels: Vessel[]; fleetTab: string; setFleetTab: (fleet: string) => void; fleetOpen: boolean; setFleetOpen: (open: boolean) => void; selectedVesselId: string | null; setSelectedVesselId: (vesselId: string | null) => void; onSelectVessel: (vesselId: string) => void }) {
  const selectedVessel = selectedVesselId ? vessels.find((item) => item.id === selectedVesselId) : null;
  return <aside className="vessel-column vessel-column-panel"><div className="vessel-column-header"><div><div className="eyebrow">Inspection / vessel detail</div><h3>Live vessel context</h3></div><SignalTag label={selectedVessel ? "Selected" : "Awaiting input"} tone={selectedVessel ? "teal" : "slate"} /></div>{selectedVessel ? <VesselDetail vessel={selectedVessel} vessels={vessels} onClose={() => setSelectedVesselId(null)} onNavigate={(vesselId) => setSelectedVesselId(vesselId)} /> : <div className="vessel-empty"><div className="vessel-empty-icon"><Ship size={24} /></div><h3>No vessel selected</h3><p>Click a vessel or route on the map to inspect.</p><span><MapPin size={12} />Inspector ready / live map linked</span></div>}{fleetOpen ? <FleetStrip vessels={vessels} activeFleet={fleetTab} onFleetChange={setFleetTab} onSelect={onSelectVessel} onClose={() => setFleetOpen(false)} /> : <button className="fleet-reopen" onClick={() => setFleetOpen(true)}><Ship size={13} />Open vessel fleet <ChevronRight size={13} /></button>}</aside>;
}

function FleetStrip({ vessels, activeFleet, onFleetChange, onSelect, onClose }: { vessels: Vessel[]; activeFleet: string; onFleetChange: (fleet: string) => void; onSelect: (vesselId: string) => void; onClose: () => void }) {
  const fleetVessels = vessels.filter((vessel) => vessel.fleet === activeFleet);
  return <section className="fleet-strip"><div className="fleet-strip-header"><div><div className="eyebrow">Fleet monitoring / local view</div><h3>Vessel fleet</h3><span>{fleetVessels.length.toString().padStart(2, "0")} vessels in {fleetLabels[activeFleet]}</span></div><button className="fleet-close" onClick={onClose} aria-label="Collapse vessel fleet"><X size={14} /></button></div><div className="fleet-tabs" role="tablist" aria-label="Vessel fleets">{fleetTabs.map((fleet) => <button key={fleet} className={`fleet-tab ${activeFleet === fleet ? "active" : ""}`} onClick={() => onFleetChange(fleet)} role="tab" aria-selected={activeFleet === fleet}>{fleetLabels[fleet]}</button>)}</div><div className="fleet-cards">{fleetVessels.map((vessel) => <button key={vessel.id} className={`vessel-card ${statusClass(vessel.status)} ${vessel.id === "msc-anna" && vessel.status === "Delayed" ? "attention" : ""}`} onClick={() => onSelect(vessel.id)}><div className="vessel-card-head"><span className="vessel-card-icon"><Ship size={16} /></span><span className="vessel-card-copy"><small>{vessel.flag} {vessel.type}</small><strong>{vessel.name}</strong></span><ArrowDownRight size={13} /></div><div className="mini-voyage"><span>{vessel.originCode}</span><div className="mini-voyage-track"><i style={{ left: `${vessel.progress}%` }} /></div><span>{vessel.destinationCode}</span></div><div className="vessel-card-footer"><span className={`vessel-status ${statusClass(vessel.status)}`}>{vessel.status}</span><span className="mini-route"><span>{vessel.flag} {vessel.originCode}</span><b>→</b><span>🇸🇬 {vessel.destinationCode}</span></span></div></button>)}</div></section>;
}

function VesselDetail({ vessel, vessels, onClose, onNavigate }: { vessel: Vessel; vessels: Vessel[]; onClose: () => void; onNavigate: (vesselId: string) => void }) {
  const index = vessels.findIndex((item) => item.id === vessel.id);
  const previous = vessels[(index - 1 + vessels.length) % vessels.length];
  const next = vessels[(index + 1) % vessels.length];
  return <section className={`vessel-detail ${statusClass(vessel.status)}`}><div className="vessel-detail-header"><div className="detail-navigation"><button onClick={() => onNavigate(previous.id)}><ChevronLeft size={13} />Previous Vessel</button><span>{(index + 1).toString().padStart(2, "0")} / {vessels.length.toString().padStart(2, "0")}</span><button onClick={() => onNavigate(next.id)}>Next Vessel<ChevronRight size={13} /></button></div><div className="detail-operator"><button className="detail-help" aria-label="Open vessel help"><HelpCircle size={14} />Help</button><span className="operator-avatar"><UserRound size={13} /></span><span>Ops Duty Manager</span><button className="fleet-close" onClick={onClose} aria-label="Close vessel detail"><X size={14} /></button></div></div><div className="vessel-identity"><div className="vessel-identity-icon"><Ship size={24} /></div><div className="vessel-identity-copy"><div className="eyebrow">{vessel.flag} / {vessel.type}</div><h3>{vessel.name}</h3><StatusPill tone={vessel.status === "At Berth" ? "green" : vessel.status === "Delayed" ? "amber" : vessel.status === "Fault Alert" ? "red" : "teal"}>{vessel.status}</StatusPill></div><div className="vessel-dates"><div><span>DEPARTURE</span><strong>{vessel.departure}</strong></div><div><span>SCHEDULED</span><strong>{vessel.scheduled}</strong></div><div><span>ESTIMATED</span><strong>{vessel.estimated}</strong></div></div></div><div className="vessel-route-detail"><div className="eyebrow">Route / live position</div><h4>The vessel is currently traveling from <strong>{vessel.flag} {vessel.origin}</strong> to <strong>🇸🇬 {vessel.destination}</strong>.</h4><div className="route-info-grid"><div><span>Current location</span><strong>{vessel.currentLocation}</strong></div><div><span>Stops</span><strong>{vessel.stops}</strong></div><div><span>Destination</span><strong>🇸🇬 {vessel.destination} / {vessel.destinationCode}</strong></div></div><div className="detail-voyage"><div className="detail-voyage-line"><span className="voyage-end"><b>{vessel.flag}</b>{vessel.originCode}</span><div className="detail-voyage-track"><div style={{ width: `${vessel.progress}%` }} /><i style={{ left: `${vessel.progress}%` }} /></div><span className="voyage-end"><b>🇸🇬</b>{vessel.destinationCode}</span></div><div className="detail-voyage-meta"><StatusPill tone="teal">{vessel.status === "At Berth" ? "At berth" : vessel.status}</StatusPill><span>{vessel.progress}% voyage complete</span><MapPin size={12} /><span>{vessel.currentLocation.split(" /")[0]}</span></div></div></div></section>;
}

function DisruptionSimulator({ scenario, setScenario, status, step, progress, confidence, confidenceTone, countdown, execution, selectedOption, setSelectedOption, approveRecovery, rejectRecovery, decisionTier, onDecisionTierChange, radar, onInspect }: { scenario: ScenarioId; setScenario: (scenario: ScenarioId) => void; status: ScenarioStatus; step: number; progress: number; confidence: number; confidenceTone: SignalTone; logs: LogEntry[]; countdown: number; execution: string[]; selectedOption: string; setSelectedOption: (option: string) => void; approveRecovery: () => void; rejectRecovery: () => void; decisionTier: DecisionTier; onDecisionTierChange: (tier: DecisionTier) => void; radar: RadarState; onInspect: (kind: ScenarioId) => void }) {
  const isNexus = scenario === "nexus";
  const steps = isNexus ? nexusSteps : squallSteps;
  const active = status !== "idle";
  return (
    <div className="view-stack">
      <div className="simulator-layout">
        <Panel className="scenario-panel" accent>
          <div className="panel-header"><div><div className="eyebrow">Continuous watch / incident log</div><h3>Live Operations Feed</h3><p>Signals arrive from AIS, equipment, yard, and weather sources. The monitor stays quiet until something changes.</p></div><div className="panel-index">INC / {active ? "OPEN" : "IDLE"}</div></div>
          <div className="monitor-banner"><Radio size={15} /><div><strong>{active ? "Incident response in progress" : "Monitoring — no active incidents"}</strong><span>{active ? "Following the live signal chain across connected systems." : "All connected feeds are nominal. Last routine check 23:09:02 SGT."}</span></div><span className="monitor-pulse" /></div>
          <div className="scenario-tabs"><button className={`scenario-tab ${isNexus ? "active" : ""}`} onClick={() => !active && setScenario("nexus")}><SignalTag label="AIS + equipment" tone={isNexus ? "amber" : "slate"} icon="alert" /><strong>Vessel & equipment watch</strong><span>MSC Anna / B3 / Tier 3 boundary</span></button><button className={`scenario-tab ${!isNexus ? "active" : ""}`} onClick={() => !active && setScenario("squall")}><SignalTag label="Weather + safety" tone={!isNexus ? "amber" : "slate"} icon="info" /><strong>Micro-climate watch</strong><span>Southwest cell / Tier 1/2 protocol</span></button></div>
          <div className={`scenario-hero ${!isNexus ? "weather" : ""}`}><div className="scenario-hero-top"><div><div className="eyebrow">{isNexus ? "AIS / EQUIPMENT SIGNAL CHAIN" : "METEOROLOGICAL / SAFETY SIGNAL CHAIN"}</div><h3>{isNexus ? "Vessel & equipment watch" : "Sumatra Squall — Micro-Climate Lockdown"}</h3><p>{isNexus ? "A live vessel signal is being correlated with equipment telemetry. The system will surface the next disposition as the feed changes." : "A fast-forming convective cell is being correlated with crane safety thresholds and pre-authorized protective action."}</p></div><SignalTag tone={!active ? "teal" : status === "resolved" ? "green" : isNexus && status === "approval" ? "amber" : "red"} label={!active ? "Monitoring" : status === "resolved" ? "Resolved" : status === "approval" ? "Approval required" : status === "lockdown" ? "Lockdown active" : "Signal active"} icon={status === "lockdown" ? "alert" : status === "resolved" ? "check" : active ? "loading" : "dot"} /></div><div className="inspection-prompt"><Radio size={13} /><span>{!active ? (isNexus ? "Inspect MSC Anna on the command map to open the live signal." : "Inspect the weather radar below to open the live signal.") : "Live signal chain open — monitoring new telemetry."}</span></div></div>
          <div className="scenario-progress"><div className="progress-head"><span>Signal chain</span><span>{active ? `${progress}% observed` : "Standby / continuous"}</span></div><div className="progress-track"><div style={{ width: `${active ? progress : 100}%` }} /></div></div>
          <div className="scenario-steps">{steps.map((item, index) => <div className={`sim-step ${index < step ? "done" : ""} ${index === step && active ? "current" : ""}`} key={item[0]}><span className="step-number">{index < step ? <Check size={11} /> : index + 1}</span><div><strong>{item[0]}</strong><span>{item[1]}</span></div><span className="step-state">{index < step ? "Done" : index === step && active ? "Live" : item[2]}</span></div>)}</div>
          <CornerMark />
        </Panel>

        <div>
          {isNexus ? <NexusTrace status={status} confidence={confidence} confidenceTone={confidenceTone} execution={execution} selectedOption={selectedOption} setSelectedOption={setSelectedOption} approveRecovery={approveRecovery} rejectRecovery={rejectRecovery} decisionTier={decisionTier} onDecisionTierChange={onDecisionTierChange} /> : <SquallTrace status={status} countdown={countdown} execution={execution} radar={radar} onInspect={onInspect} />}
        </div>
      </div>
      <div className="credibility-note"><Info size={14} />{isNexus ? "The vessel and equipment monitor intentionally stops at the human boundary. The system can propose recovery, but it cannot silently commit a Tier 3 SLA trade-off." : "Weather lockdown is a pre-authorized Tier 1/2 safety protocol — no manual approval required when protective thresholds are breached."}</div>
    </div>
  );
}

function NexusTrace({ status, confidence, confidenceTone, execution, selectedOption, setSelectedOption, approveRecovery, rejectRecovery, decisionTier, onDecisionTierChange }: { status: ScenarioStatus; confidence: number; confidenceTone: SignalTone; execution: string[]; selectedOption: string; setSelectedOption: (option: string) => void; approveRecovery: () => void; rejectRecovery: () => void; decisionTier: DecisionTier; onDecisionTierChange: (tier: DecisionTier) => void }) {
  const approval = status === "approval";
  const resolved = status === "resolved";
  return <div className="view-stack"><Panel className="trace-panel"><div className="panel-header"><div><div className="eyebrow">Deterministic policy gate</div><h3>Reasoning → Disposition Trace</h3></div><SignalTag label={resolved ? "Resolved" : approval ? "Decision tier 3" : "Observing"} tone={resolved ? "green" : approval ? "amber" : "teal"} icon={resolved ? "check" : approval ? "alert" : "dot"} /></div><div className="trace-status"><BrainCircuit size={15} /><strong>Policy Engine</strong><span>{resolved ? "recovery path committed" : approval ? "awaiting duty manager" : "watching live inputs"}</span></div><div className="confidence-box"><div className="confidence-head"><div><span>Tool confidence</span><TinySparkline points={[91, 91, 88, 84, 67, confidence]} tone={confidenceTone} /></div><div className="confidence-number">{confidence.toFixed(0)}<small>%</small></div></div><div className="confidence-bar"><div style={{ width: `${confidence}%`, background: confidenceTone === "amber" ? "#edb15c" : confidenceTone === "green" ? "#79d8c7" : "#66e0d2" }} /></div><div className="confidence-note">{confidence < 75 ? "Tool confidence degraded — do not hallucinate missing data." : "Telemetry freshness is inside policy tolerance."}</div></div>{confidence < 75 && <div className="alert-banner"><CircleAlert size={15} />Tool confidence degraded — do not hallucinate missing data.</div>}<div className="trace-list"><TraceRow label="SLA breach risk" value={approval || resolved ? "HIGH" : "ASSESSING"} tone={approval || resolved ? "amber" : "slate"} icon={TriangleAlert} /><TraceRow label="Tool confidence" value={confidence < 75 ? "DEGRADED" : "NOMINAL"} tone={confidence < 75 ? "amber" : "teal"} icon={Activity} /><TraceRow label="Decision tier" value={approval ? "3 — HUMAN APPROVAL" : resolved ? `${decisionTier} — APPROVED` : `${decisionTier} — ${decisionTierDetails[decisionTier].label.toUpperCase()}`} tone={approval ? "red" : resolved ? "green" : "slate"} icon={UserRound} /></div><div className="decision-tier-panel"><div><div className="eyebrow">Operator choice / vessel + equipment watch</div><strong>How much autonomy is safe?</strong></div><div className="decision-tier-choices">{(["1", "2", "3"] as DecisionTier[]).map((tier) => <button key={tier} className={`decision-tier-choice ${decisionTier === tier ? "selected" : ""} tier-${tier}`} onClick={() => onDecisionTierChange(tier)} aria-pressed={decisionTier === tier}><span>Tier {tier}</span><strong>{decisionTierDetails[tier].label}</strong><small>{decisionTierDetails[tier].short}</small></button>)}</div><p>{decisionTierDetails[decisionTier].description}</p></div>{execution.length > 0 && <div className="trace-list" style={{ marginTop: 18 }}><div className="eyebrow" style={{ padding: "14px 0 3px" }}>Cross-system execution</div>{["TOS updated", "Crane Scheduler updated", "Yard Manager rebalanced", "MPA notification sent"].map((item) => <TraceRow key={item} label={item} value={execution.includes(item) ? "COMMITTED" : "QUEUED"} tone={execution.includes(item) ? "green" : "slate"} icon={execution.includes(item) ? CheckCircle2 : Timer} />)}</div>}</Panel>{approval && <ApprovalPanel selectedOption={selectedOption} setSelectedOption={setSelectedOption} approveRecovery={approveRecovery} rejectRecovery={rejectRecovery} />}</div>;
}

function TraceRow({ label, value, tone, icon: Icon }: { label: string; value: string; tone: SignalTone; icon: typeof Activity }) {
  return <div className={`trace-row ${tone === "green" ? "done" : tone === "amber" ? "active" : ""}`}><div><Icon size={14} /><span>{label}</span></div><b>{value}</b></div>;
}

function ApprovalPanel({ selectedOption, setSelectedOption, approveRecovery, rejectRecovery }: { selectedOption: string; setSelectedOption: (option: string) => void; approveRecovery: () => void; rejectRecovery: () => void }) {
  const recoveryOptions = [
    { id: "A", title: "Re-sequence berth window", eta: "55 min", copy: "Fastest recovery; risks MSC Anna berth SLA" },
    { id: "B", title: "Split discharge to C5/C8", eta: "42 min", copy: "Protects berth plan; adds 18 min yard travel" },
    { id: "C", title: "Hold and reassess", eta: "0 min", copy: "Lowest operational change; extends vessel delay" },
  ];
  return <Panel className="approval-panel" accent><div className="approval-context"><div className="approval-tier-icon"><CircleAlert size={20} /></div><div><div className="approval-tier-label">TIER 3 · APPROVAL REQUIRED</div><h3>Controlled recovery for MSC Anna</h3><p>Confidence fell from 91% to 67% after QC-07 telemetry retries failed.</p></div></div><div className="approval-options">{recoveryOptions.map((option) => <button key={option.id} className={`recovery-option ${selectedOption === option.id ? "selected" : ""}`} onClick={() => setSelectedOption(option.id)} aria-pressed={selectedOption === option.id}><span className="recovery-option-copy"><strong>Option {option.id} · {option.title}</strong><small>{option.copy}</small></span><b>{option.eta}</b></button>)}</div><div className="approval-actions"><button className="primary-action" onClick={approveRecovery}><Check size={16} />Approve</button><button className="secondary-action reject-action" onClick={rejectRecovery}><X size={16} />Reject</button></div><div className="approval-footnote"><ShieldCheck size={12} />Nothing commits until the duty manager approves a recovery path.</div><CornerMark /></Panel>;
}

function SquallTrace({ status, countdown, execution, radar, onInspect }: { status: ScenarioStatus; countdown: number; execution: string[]; radar: RadarState; onInspect: (kind: ScenarioId) => void }) {
  const resolved = status === "resolved";
  const radarLabel = radar.status === "live" ? `NEA RADAR · ${radar.range ?? "70km"} · CAPTURE ${formatRadarTime(radar.capturedAt)}` : radar.status === "loading" ? "NEA RADAR · REQUESTING CURRENT IMAGE" : "NEA RADAR · CSS FALLBACK FIELD";
  return <div className="view-stack"><Panel className="weather-panel" accent onClick={status === "idle" ? () => onInspect("squall") : undefined}><div className="weather-visual">{radar.imageUrl && <img className="radar-api-image" src={radar.imageUrl} alt="NEA weather radar capture around Singapore" />}<div className="weather-copy"><div className="eyebrow">Micro-climate monitor / SW approach</div><h3>Sumatra Squall — forming</h3><p>{resolved ? "All-clear detected — wind speeds below threshold." : "Fast-forming convective cell approaching Tuas from the southwest."}</p>{status === "idle" && <div className="weather-inspection-hint"><Radio size={12} />Inspect radar to refresh live signal</div>}</div><div className="weather-sweep" /><div className="weather-cell" /><div className="weather-data-badge"><span className={`radar-dot ${radar.status}`} />{radarLabel}</div><div className="weather-metrics"><div>ETA TO TUAS<strong>{resolved ? "CLEAR" : "28 MIN"}</strong></div><div className="weather-metric-divider" /><div>WIND PROJECTION<strong>{resolved ? "31 KT" : "62 KT"}</strong></div><div className="weather-metric-divider" /><div>RADAR UPDATED<strong>{formatRadarTime(radar.updatedAt)}</strong></div></div></div></Panel><Panel className="trace-panel"><div className="panel-header"><div><div className="eyebrow">Instant circuit breaker</div><h3>Safety Response Trace</h3></div><SignalTag label={resolved ? "All-clear" : status === "lockdown" ? "Armed" : "Standby"} tone={resolved ? "green" : status === "lockdown" ? "amber" : "teal"} icon={resolved ? "check" : status === "lockdown" ? "alert" : "dot"} /></div><div className="trace-status"><LockKeyhole size={15} /><strong>Pre-authorized Tier 1/2 protocol</strong><span>{resolved ? "resume state committed" : "no human approval required"}</span></div>{status === "lockdown" || resolved ? <div className="countdown-card"><div className="countdown-head"><strong>{resolved ? "All-clear — operations restored" : "Lockdown active — est. duration 45 min"}</strong><span className="countdown-timer">{resolved ? "00:00" : `00:${countdown.toString().padStart(2, "0")}`}</span></div><p>{resolved ? "Pins unlocked, AGVs resumed, and berth schedule reconciled." : "15 real seconds represent the 45-minute safety window."}</p><CountdownBar percent={resolved ? 100 : ((45 - countdown) / 45) * 100} tone={resolved ? "green" : "amber"} /></div> : <div className="alert-banner" style={{ marginTop: 17 }}><Wind size={15} />The breaker arms automatically when sustained wind projection crosses 55 knots.</div>}<div className="trace-list"><TraceRow label="RMC-12 / anti-typhoon pins" value={execution.includes("RMC-12 pins locked") ? resolved ? "UNLOCKED" : "LOCKED" : "QUEUED"} tone={resolved ? "green" : execution.includes("RMC-12 pins locked") ? "amber" : "slate"} icon={LockKeyhole} /><TraceRow label="RMC-13 / anti-typhoon pins" value={execution.includes("RMC-13 pins locked") ? resolved ? "UNLOCKED" : "LOCKED" : "QUEUED"} tone={resolved ? "green" : execution.includes("RMC-13 pins locked") ? "amber" : "slate"} icon={LockKeyhole} /><TraceRow label="RMC-14 / anti-typhoon pins" value={execution.includes("RMC-14 pins locked") ? resolved ? "UNLOCKED" : "LOCKED" : "QUEUED"} tone={resolved ? "green" : execution.includes("RMC-14 pins locked") ? "amber" : "slate"} icon={LockKeyhole} /><TraceRow label="AGV fleet / 14 units" value={execution.includes("AGV fleet resumed") ? "RESUMED" : execution.includes("14 AGVs rerouted") ? "REROUTED" : "QUEUED"} tone={resolved ? "green" : execution.includes("14 AGVs rerouted") ? "amber" : "slate"} icon={Container} /><TraceRow label="Shipping lines / 3 affected" value={execution.includes("Berth ETAs reconciled") ? "RECONCILED" : execution.includes("3 shipping lines notified") ? "NOTIFIED" : "QUEUED"} tone={resolved ? "green" : execution.includes("3 shipping lines notified") ? "amber" : "slate"} icon={Ship} /></div></Panel></div>;
}

function PolicyView() {
  const tiers = [
    { cls: "tier-one", num: "01", tone: "green" as SignalTone, title: "Auto-Execute", description: "Deterministic, reversible actions inside safety bounds.", items: ["Lock anti-typhoon pins", "Reroute AGV fleet to safe zones", "Rebalance berth windows"] },
    { cls: "tier-two", num: "02", tone: "amber" as SignalTone, title: "Execute + Notify", description: "Low-risk coordination with a visible operator notice.", items: ["Dispatch revised ETAs", "Reprioritize yard blocks", "Shift equipment matching"] },
    { cls: "tier-three", num: "03", tone: "red" as SignalTone, title: "Human Approval", description: "Material SLA, safety, or commercial trade-offs stop here.", items: ["Choose recovery path", "Accept SLA breach exposure", "Commit cross-system change"] },
  ];
  return <div className="view-stack"><div className="policy-grid">{tiers.map((tier) => <div className={`tier-card ${tier.cls}`} key={tier.title}><div className={`tier-number signal-${tier.tone}`}><span>TIER / {tier.num}</span><b>{tier.tone === "green" ? "✓" : tier.tone === "amber" ? "!" : "人"}</b></div><h3>{tier.title}</h3><p>{tier.description}</p><ul className="tier-list">{tier.items.map((item) => <li key={item}><Check size={13} />{item}</li>)}</ul></div>)}</div><div className="flow-strip"><div className="flow-node"><BrainCircuit size={15} color="#79d8c7" /><strong>LLM proposes</strong><span>Reason over live context</span></div><ArrowRight className="flow-arrow" size={18} /><div className="flow-node policy"><ShieldCheck size={15} color="#edb15c" /><strong>Policy engine disposes</strong><span>Deterministic rules + confidence</span></div><ArrowRight className="flow-arrow" size={18} /><div className="flow-node"><Zap size={15} color="#79d8c7" /><strong>Execute / notify / escalate</strong><span>Visible operator boundary</span></div></div><Panel className="info-card"><div className="eyebrow">Design principle / 04</div><h3>Make the safe path the easy path.</h3><p>Portwatch-Tuas does not ask a language model to decide whether a decision is safe. It asks the model to make a proposal, then lets a deterministic policy and safety gate decide what happens next.</p></Panel></div>;
}

function ArchitectureView() {
  return <div className="architecture-layout"><Panel className="arch-diagram" accent><SectionHeading eyebrow="Layered topology" title="Fast execution. Accountable reasoning." detail="The operating model separates context, coordination, and hard real-time action with one visible safety gate." /><div className="arch-layers"><ArchLayer index="01" className="cloud" title="Cloud tier" copy="Global shipping network sync & MPA digital compliance" nodes={["Network sync", "Compliance"]} /><ArchLayer index="02" className="edge" title="Edge tier" copy="Digital twin & regional coordination" nodes={["Inter-gateway load balance", "Micro-climate modeling"]} /><div className="arch-gate"><ShieldCheck size={16} /><div><strong>Deterministic Policy & Safety Gate</strong><span>Reasoning stops here · confidence + rules + human boundary</span></div></div><ArchLayer index="03" className="device" title="Device tier" copy="Hard real-time execution at the terminal edge" nodes={["A-TOS / AGV fleet", "Strait collision avoidance"]} /></div><CornerMark /></Panel><div className="arch-side"><Panel className="info-card"><div className="eyebrow">Why it matters</div><h3>No hallucination at the actuator.</h3><p>When a tool times out, the system marks confidence degraded instead of filling the gap. When a decision is material, the gate stops the sequence and asks a person.</p><ul className="principle-list"><li><span>01</span>Graceful fallback to cached state</li><li><span>02</span>Pre-authorized circuits for safety</li><li><span>03</span>Audit hash on every committed path</li></ul></Panel><Panel className="info-card"><div className="eyebrow">Signal paths</div><h3>Three speeds, one language.</h3><p>Cloud context informs the edge. Edge coordination shapes the device plan. The same status vocabulary follows the handoff so operators can see where certainty ends.</p><div style={{ marginTop: 16 }}><StatusPill tone="teal">Context synced</StatusPill> <StatusPill tone="amber">Gate armed</StatusPill> <StatusPill tone="red">Actuator fault</StatusPill></div></Panel></div></div>;
}

function ArchLayer({ index, className, title, copy, nodes }: { index: string; className: string; title: string; copy: string; nodes: string[] }) {
  return <div className={`arch-layer ${className}`}><span className="layer-index">LAYER {index}</span><div className="layer-copy"><h3>{title}</h3><p>{copy}</p></div><div className="layer-nodes">{nodes.map((node) => <span className="layer-node" key={node}>{node}</span>)}</div></div>;
}

function RoadmapView() {
  const modules = [
    ["02.01", "Vessel Bunching Predictor", "With the majority of vessels arriving off schedule industry-wide, single-vessel delay handling is not enough. Forecast when multiple ETAs converge on the same berth window and smooth allocation before congestion compounds.", "Priority / active concept"],
    ["02.02", "Yard & Equipment Scarcity Matcher", "When occupancy runs near capacity and chassis or containers are scarce, the bottleneck is matching the right slot and equipment to the right box. Reprioritize by connection window, SLA tier, and dwell time.", "Priority / active concept"],
    ["02.03", "Frontline Workforce Load-Balancer", "Recommend short-term shift and labor reallocation during a disruption — extending the human-in-the-loop story beyond cranes and AGVs to people on the ground.", "Research / next"],
    ["02.04", "Geopolitical & Macro Shock Absorber", "Ingest headline-level rerouting signals and pre-warn the system of surge windows, feeding inter-gateway load balancing before the surge physically arrives.", "Research / next"],
  ];
  return <div className="view-stack"><div className="roadmap-grid">{modules.map(([num, title, body, status]) => <article className="roadmap-card" key={num}><div className="roadmap-number">{num} / PHASE 2</div><div className="module-status"><SignalTag label={status} tone={status.includes("Priority") ? "teal" : "slate"} /></div><h3>{title}</h3><p>{body}</p></article>)}</div><div className="credibility-note"><Anchor size={14} />Aligned with industry direction: Portwatch-Tuas's Inter-Gateway Transfer concept reflects PSA/MPA's April 2026 call for proposals to test autonomous inter-gateway container feeder vessels — this is an active problem space, not a hypothetical one.</div><Panel className="info-card"><div className="eyebrow">Roadmap logic</div><h3>Move from incident recovery to system shaping.</h3><p>Phase 1 demonstrates the decision boundary. Phase 2 makes the port resilient before a single incident becomes a queue, a yard jam, or a workforce scramble.</p><LinkButton>View concept map</LinkButton></Panel></div>;
}

function AuditView({ audit }: { audit: AuditRow[] }) {
  return <div className="view-stack"><Panel className="audit-panel" accent><div className="panel-header"><div><div className="eyebrow">Illustrative local ledger</div><h3>Past logged decisions</h3><p>Every live incident appends a cosmetic hash-like ID to show the expected audit shape.</p></div><div className="panel-index">{audit.length.toString().padStart(2, "0")} ROWS</div></div><div className="audit-table-wrap"><table className="audit-table"><thead><tr><th>Timestamp</th><th>Event</th><th>Tier</th><th>Decision</th><th>Operator</th><th>Status</th><th>Audit ID</th></tr></thead><tbody>{audit.map((row, index) => <tr key={`${row.hash}-${index}`}><td>{row.time}</td><td className="audit-event">{row.event}</td><td><SignalTag label={row.tier} tone={row.tier.includes("1") ? "green" : row.tier.includes("3") ? "red" : "amber"} /></td><td>{row.decision}</td><td>{row.operator}</td><td><StatusPill tone={row.status === "Resolved" ? "green" : row.status === "Approved" ? "amber" : "teal"}>{row.status}</StatusPill></td><td className="hash">{row.hash}</td></tr>)}</tbody></table></div><div className="audit-caption">ILLUSTRATIVE DATA · IDENTIFIERS ARE NON-PRODUCTION · NO REAL VESSEL IMO NUMBERS OR MPA DOCUMENT FORMATS USED</div><CornerMark /></Panel><div className="flow-strip"><div className="flow-node"><ClipboardCheck size={15} color="#79d8c7" /><strong>Decision captured</strong><span>Context + tier + operator</span></div><ArrowRight className="flow-arrow" size={18} /><div className="flow-node"><FileClock size={15} color="#edb15c" /><strong>Audit event appended</strong><span>Immutable shape, cosmetic hash</span></div><ArrowRight className="flow-arrow" /><div className="flow-node"><ShieldCheck size={15} color="#79d8c7" /><strong>Reviewable later</strong><span>Operational memory compounds</span></div></div></div>;
}
