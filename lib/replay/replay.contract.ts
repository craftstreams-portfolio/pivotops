import { EventTrace } from "../events/event.schema";

// ===============================
// REPLAY MODES
// ===============================
export type ReplayMode =
  | "normal"
  | "safe"
  | "dry_run";

// ===============================
// REPLAY INPUT CONTRACT
// ===============================
export type ReplayRequest = {
  eventId: string;

  mode: ReplayMode;
};

// ===============================
// REPLAY RESULT CONTRACT
// ===============================
export type ReplayResult = {
  eventId: string;

  success: boolean;

  mode: ReplayMode;

  replayedAt: string;

  message: string;
};

// ===============================
// REPLAY EVENT FUNCTION TYPE
// ===============================
export type ReplayEventFn = (
  input: ReplayRequest
) => Promise<ReplayResult>;