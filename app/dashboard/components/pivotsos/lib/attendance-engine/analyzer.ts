import { getSessions } from "./session";

export function computeWorkHours(userId: string) {
  const sessions = getSessions().filter(s => s.userId === userId && s.clockOut);

  let total = 0;

  for (const s of sessions) {
    total += (s.clockOut! - s.clockIn) / 1000 / 60 / 60;
  }

  return total;
}