import { calculateSystemRisk } from "./risk-model";
import { forecastHealth } from "./forecast-engine";
import { generateSuggestion } from "./auto-suggestions";
import { SystemSignal } from "./signal-collector";

export function runPredictiveEngine(signals: SystemSignal[]) {
  const risk = calculateSystemRisk(signals);
  const forecast = forecastHealth(signals);
  const suggestion = generateSuggestion(risk);

  return {
    risk,
    forecast,
    suggestion,
  };
}