/**
 * PivotOps Enterprise Intelligence Types
 * Phase 23F → 23G unified contract layer
 */

/* =========================
   WORKFORCE EVENTS
========================= */

export type WorkforceEventType =
  | "SOS_INCIDENT_CREATED"
  | "SOS_INCIDENT_UPDATED"
  | "CLOCK_IN"
  | "CLOCK_OUT";

export interface WorkforceEvent {
  type: WorkforceEventType;
  payload: any;
  timestamp: number;
}

/* =========================
   LEDGER EVENT (PERSISTED)
========================= */

export interface LedgerEvent {
  id: string;
  type: WorkforceEventType;
  payload: any;
  timestamp: number;
}

/* =========================
   REALTIME BROADCAST EVENT
========================= */

export interface RealtimeWorkforceEvent {
  event: WorkforceEventType;
  payload: any;
  timestamp?: number;
}

/* =========================
   AI ACTION SYSTEM
========================= */

export type ActionType =
  | "SEND_ALERT"
  | "SUGGEST_STAFFING"
  | "ESCALATE_INCIDENT"
  | "AUTO_REASSIGN_TASKS"
  | "NO_ACTION";

export interface AIAction {
  type: ActionType;
  confidence: number;
  reason: string;
}

/* =========================
   RISK ENGINE
========================= */

export type RiskStatus = "stable" | "high" | "critical";

export interface RiskAssessment {
  riskScore: number;
  status: RiskStatus;
}

/* =========================
   EXECUTIVE INTELLIGENCE
========================= */

export interface ExecutiveSummary {
  insight: string;
  metrics: {
    totalEvents: number;
    sosIncidents: number;
    clockInRate: number;
    systemHealth: string;
  };
}

/* =========================
   DIGITAL TWIN SIMULATION
========================= */

export interface DigitalTwinState {
  horizon: string;
  projectedSOS: number;
  projectedRisk: RiskStatus;
  recommendation: string;
}

/* =========================
   CONTROL LOOP ACTION RESULT
========================= */

export interface ControlLoopResult {
  executed: boolean;
  action?: AIAction;
  timestamp: number;
}

/* =========================
   LISTENER SYSTEM
========================= */

export type Listener = (event: WorkforceEvent) => void;

/* =========================
   ENGINE GLOBAL STATE (OPTIONAL EXTENSION HOOK)
========================= */

export interface EngineState {
  activeListeners: number;
  lastEventTimestamp?: number;
  riskStatus: RiskStatus;
}