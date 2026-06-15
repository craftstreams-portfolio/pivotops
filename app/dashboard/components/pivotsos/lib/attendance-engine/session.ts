import { emitEvent } from "../../../../lib/event-bus/workforceBus";

export interface WorkSession {
  userId: string;
  clockIn: number;
  clockOut?: number;
  status: "active" | "completed";
}

const sessions: WorkSession[] = [];

export function clockIn(userId: string) {
  const existingSession = sessions.find(
    (s) => s.userId === userId && s.status === "active"
  );

  if (existingSession) {
    return existingSession;
  }

  const session: WorkSession = {
    userId,
    clockIn: Date.now(),
    status: "active",
  };

  sessions.push(session);

  emitEvent({
    type: "CLOCK_IN",
    payload: session,
    timestamp: Date.now(),
  });

  return session;
}

export function clockOut(userId: string) {
  const session = sessions.find(
    (s) => s.userId === userId && s.status === "active"
  );

  if (!session) {
    return null;
  }

  session.clockOut = Date.now();
  session.status = "completed";

  emitEvent({
    type: "CLOCK_OUT",
    payload: session,
    timestamp: Date.now(),
  });

  return session;
}

export function getSessions() {
  return sessions;
}

export function getActiveSessions() {
  return sessions.filter((s) => s.status === "active");
}

export function getCompletedSessions() {
  return sessions.filter((s) => s.status === "completed");
}

export function getUserSessions(userId: string) {
  return sessions.filter((s) => s.userId === userId);
}

export function calculateSessionDuration(session: WorkSession) {
  if (!session.clockOut) {
    return 0;
  }

  return (session.clockOut - session.clockIn) / 1000 / 60 / 60;
}