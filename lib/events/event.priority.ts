export type EventPriority = "LOW" | "NORMAL" | "HIGH" | "CRITICAL";

export function getPriorityScore(priority: EventPriority) {
  switch (priority) {
    case "CRITICAL":
      return 4;
    case "HIGH":
      return 3;
    case "NORMAL":
      return 2;
    case "LOW":
      return 1;
    default:
      return 2;
  }
}