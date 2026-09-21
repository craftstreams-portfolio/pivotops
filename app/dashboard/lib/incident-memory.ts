import { IncidentRecord } from "./root-cause-engine";

let incidentLog: IncidentRecord[] = [];

// ===============================
// STORE INCIDENT
// ===============================
export function logIncident(incident: IncidentRecord) {
  incidentLog.push(incident);

  // keep memory bounded
  incidentLog = incidentLog.slice(-100);
}

// ===============================
// GET INCIDENTS
// ===============================
export function getIncidents(): IncidentRecord[] {
  return incidentLog;
}