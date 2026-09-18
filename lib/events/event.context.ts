export type EventContext = {
  eventId: string;
  traceId: string;
  workerId?: string;
  attempt: number;
  startedAt: number;
};