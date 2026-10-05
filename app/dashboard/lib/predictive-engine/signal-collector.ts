export type SystemSignal = {
  type: "workflow" | "performance" | "error" | "load";
  severity: number; // 0 - 1
  timestamp: number;
};

export function collectSignal(
  type: SystemSignal["type"],
  severity: number
): SystemSignal {
  return {
    type,
    severity,
    timestamp: Date.now(),
  };
}