import {
  getIncidents,
} from "./incident-memory";

import {
  detectPattern,
  generateRootCause,
} from "./root-cause-engine";

// ===============================
// RUN SYSTEM ANALYSIS
// ===============================
export function runRootCauseAnalysis() {
  const incidents = getIncidents();

  const pattern = detectPattern(incidents);

  const analysis = generateRootCause(pattern);

  return analysis;
}