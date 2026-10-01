export function generateSuggestion(risk: number) {
  if (risk > 0.8) {
    return "CRITICAL: Trigger auto-recovery & scale workers";
  }

  if (risk > 0.6) {
    return "WARNING: Monitor closely and pre-warm recovery systems";
  }

  if (risk > 0.3) {
    return "CAUTION: Minor instability detected";
  }

  return "SYSTEM STABLE: No action required";
}