export type EventCognitionReport = {
  severity: "low" | "medium" | "high" | "critical";
  category: "worker" | "queue" | "database" | "timeout" | "unknown";
  confidence: number;
};