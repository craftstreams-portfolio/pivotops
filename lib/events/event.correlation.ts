import { randomUUID } from "crypto";
import { EventContext } from "./event.context";

// ===============================
// CREATE TRACE CONTEXT
// ===============================
export function createEventContext(eventId: string): EventContext {
  return {
    eventId,
    traceId: randomUUID(),
    attempt: 0,
    startedAt: Date.now(),
  };
}

// ===============================
// INCREMENT ATTEMPT
// ===============================
export function nextAttempt(ctx: EventContext): EventContext {
  return {
    ...ctx,
    attempt: ctx.attempt + 1,
  };
}