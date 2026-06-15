export type EventLane = "CRITICAL" | "HIGH" | "NORMAL" | "LOW";

export function getLaneWeight(lane: EventLane) {
  switch (lane) {
    case "CRITICAL":
      return 100;
    case "HIGH":
      return 70;
    case "NORMAL":
      return 40;
    case "LOW":
      return 10;
    default:
      return 40;
  }
}