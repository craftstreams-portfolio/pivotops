import { storeLedgerEvent } from "./workforceLedger";
import { broadcastWorkforceEvent } from "../realtime/workforceRealtime";

export type WorkforceEventType =
  | "SOS_INCIDENT_CREATED"
  | "SOS_INCIDENT_UPDATED"
  | "CLOCK_IN"
  | "CLOCK_OUT";

export interface WorkforceEvent {
  type: WorkforceEventType;
  payload: any;
  timestamp: number;
}

type Listener = (event: WorkforceEvent) => void;
const listeners: Listener[] = [];

export async function emitEvent(event: WorkforceEvent): Promise<void> {
  storeLedgerEvent({
    id: crypto.randomUUID(),
    type: event.type,
    payload: event.payload,
    timestamp: event.timestamp,
  });

  try {
    await broadcastWorkforceEvent(event.type, event.payload);
  } catch (error) {
    console.error("Realtime workforce broadcast failed:", error);
  }

  listeners.forEach((listener) => {
    listener(event);
  });
}

export function subscribe(listener: Listener) {
  listeners.push(listener);
  return () => {
    const index = listeners.indexOf(listener);
    if (index > -1) {
      listeners.splice(index, 1);
    }
  };
}

export function clearListeners() {
  listeners.length = 0;
}

export function getListenerCount() {
  return listeners.length;
}