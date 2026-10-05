import { WorkSession } from "./session";

export interface AttendanceAnomaly {
  type: string;
  severity: "low" | "medium" | "high";
  message: string;
}

export function detectAttendanceAnomalies(
  sessions: WorkSession[]
): AttendanceAnomaly[] {
  const anomalies: AttendanceAnomaly[] = [];

  for (const session of sessions) {
    if (session.clockOut) {
      const duration =
        (session.clockOut - session.clockIn) / 1000 / 60 / 60;

      if (duration > 16) {
        anomalies.push({
          type: "EXCESSIVE_SHIFT",
          severity: "high",
          message: `User ${session.userId} exceeded 16 working hours.`,
        });
      }

      if (duration < 0.1) {
        anomalies.push({
          type: "RAPID_CLOCK_OUT",
          severity: "medium",
          message: `User ${session.userId} clocked out too quickly.`,
        });
      }
    }
  }

  return anomalies;
}