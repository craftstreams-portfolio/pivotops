import { getLedgerEvents } from "../event-bus/workforceLedger";

export function buildReplayTimeline() {
  const events = getLedgerEvents();

  return events
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((event, index) => ({
      step: index + 1,
      type: event.type,
      timestamp: event.timestamp,
      payload: event.payload,
    }));
}
