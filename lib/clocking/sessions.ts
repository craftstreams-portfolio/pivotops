/**
 * Shared session builder for clocking logs.
 *
 * Sessions used to be built by pairing a CLOCK_IN with whatever log came next.
 * Once BREAK_START / BREAK_END rows exist in the same table that pairing breaks —
 * the next row after a CLOCK_IN is a break, so the session reads as never closed.
 * Everything that needs worked hours goes through here instead.
 */

export type ClockType = "CLOCK_IN" | "CLOCK_OUT" | "BREAK_START" | "BREAK_END";

export interface ClockEvent {
  id?:        string;
  user_id?:   string;
  type:       string;
  timestamp:  string;
  [k: string]: any;
}

export interface BreakSpan {
  start: string;
  end:   string | null;   // null = still on break
  ms:    number;          // counts up to now while open
}

export interface WorkSession {
  in:       ClockEvent;
  out:      ClockEvent | null;   // null = still on shift
  breaks:   BreakSpan[];
  grossMs:  number;   // clock-in to clock-out (or now)
  breakMs:  number;   // total time on break
  netMs:    number;   // grossMs - breakMs, never below zero
  open:     boolean;
  onBreak:  boolean;
}

const ts = (v: string) => new Date(v).getTime();

export interface SessionOptions {
  /** Paid breaks: break time still counts as worked time. Tenant policy. */
  paidBreaks?: boolean;
}

/** Build complete sessions, break-aware, from a flat log list. */
export function buildSessions(
  logs: ClockEvent[],
  now: number = Date.now(),
  opts: SessionOptions = {}
): WorkSession[] {
  const paidBreaks = opts.paidBreaks === true;
  const sorted = [...logs].sort((a, b) => ts(a.timestamp) - ts(b.timestamp));
  const out: WorkSession[] = [];
  let cur: WorkSession | null = null;

  const finalise = (s: WorkSession) => {
    const end = s.out ? ts(s.out.timestamp) : now;
    s.grossMs = Math.max(0, end - ts(s.in.timestamp));
    for (const b of s.breaks) {
      const bEnd = b.end ? ts(b.end) : (s.out ? ts(s.out.timestamp) : now);
      b.ms = Math.max(0, bEnd - ts(b.start));
    }
    s.breakMs = s.breaks.reduce((n, b) => n + b.ms, 0);
    // Breaks are always measured and shown. Whether they are deducted is policy.
    s.netMs   = paidBreaks ? s.grossMs : Math.max(0, s.grossMs - s.breakMs);
    s.open    = !s.out;
    s.onBreak = s.open && s.breaks.some((b) => !b.end);
    return s;
  };

  for (const log of sorted) {
    switch (log.type) {
      case "CLOCK_IN":
        // A second CLOCK_IN without a CLOCK_OUT: close the previous one rather
        // than dropping it, so a forgotten clock-out doesn't erase the session.
        if (cur) out.push(finalise(cur));
        cur = { in: log, out: null, breaks: [], grossMs: 0, breakMs: 0, netMs: 0, open: true, onBreak: false };
        break;

      case "BREAK_START":
        if (cur && !cur.breaks.some((b) => !b.end)) {
          cur.breaks.push({ start: log.timestamp, end: null, ms: 0 });
        }
        break;

      case "BREAK_END": {
        const open = cur?.breaks.find((b) => !b.end);
        if (open) open.end = log.timestamp;
        break;
      }

      case "CLOCK_OUT":
        if (cur) {
          // Clocking out while on break closes the break at the same moment.
          const open = cur.breaks.find((b) => !b.end);
          if (open) open.end = log.timestamp;
          cur.out = log;
          out.push(finalise(cur));
          cur = null;
        }
        break;
    }
  }

  if (cur) out.push(finalise(cur));
  return out;
}

export type ClockStatus = "out" | "in" | "break";

export interface LiveStatus {
  status:      ClockStatus;
  since:       string | null;  // when the current state began
  session:     WorkSession | null;
  breakStart:  string | null;
}

/** Current live state for one user. */
export function getLiveStatus(
  logs: ClockEvent[],
  now: number = Date.now(),
  opts: SessionOptions = {}
): LiveStatus {
  const sessions = buildSessions(logs, now, opts);
  const last = sessions[sessions.length - 1];
  if (!last || !last.open) {
    return { status: "out", since: null, session: null, breakStart: null };
  }
  const openBreak = last.breaks.find((b) => !b.end);
  return {
    status:     openBreak ? "break" : "in",
    since:      openBreak ? openBreak.start : last.in.timestamp,
    session:    last,
    breakStart: openBreak?.start ?? null,
  };
}

export interface ScheduleWindow {
  start_time: string;
  end_time:   string;
}

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Rostered milliseconds for a date, or null when nothing was scheduled. */
export function scheduledMsForDate(dateKey: string, schedules: ScheduleWindow[]): number | null {
  const rows = schedules.filter((s) => ymd(new Date(s.start_time)) === dateKey);
  if (rows.length === 0) return null;
  let ms = 0;
  for (const s of rows) {
    const st = new Date(s.start_time).getTime();
    const en = new Date(s.end_time).getTime();
    if (en > st) ms += en - st;
  }
  return ms;
}

/**
 * The rostered window that governs a session: the one containing the clock-in,
 * otherwise the last window that had already started when the shift began.
 * Only ONE window applies — overlapping rosters never sum.
 */
export function applicableSchedule(
  session: WorkSession,
  schedules: ScheduleWindow[]
): ScheduleWindow | null {
  const start = new Date(session.in.timestamp).getTime();
  const sorted = [...schedules].sort(
    (a, b) => new Date(a.end_time).getTime() - new Date(b.end_time).getTime()
  );
  const containing = sorted.filter((s) => {
    const st = new Date(s.start_time).getTime();
    const en = new Date(s.end_time).getTime();
    return start >= st && start <= en;
  });
  // Latest-ending containing window, so a shift extended by a second roster
  // uses the later boundary rather than tripping OT at the earlier one.
  if (containing.length) return containing[containing.length - 1];

  const dateKey = ymd(new Date(session.in.timestamp));
  const sameDay = sorted.filter((s) => ymd(new Date(s.start_time)) === dateKey);
  return sameDay.length ? sameDay[sameDay.length - 1] : null;
}

/** Break milliseconds falling inside [from, to). */
function breakMsWithin(session: WorkSession, from: number, to: number, now: number): number {
  if (to <= from) return 0;
  let ms = 0;
  const sessionEnd = session.out ? new Date(session.out.timestamp).getTime() : now;
  for (const b of session.breaks) {
    const bs = new Date(b.start).getTime();
    const be = b.end ? new Date(b.end).getTime() : sessionEnd;
    ms += Math.max(0, Math.min(be, to) - Math.max(bs, from));
  }
  return ms;
}

/**
 * Split a session into regular and overtime at the scheduled END TIME.
 *
 * Overtime is a wall-clock boundary, not an hours budget: the second the
 * rostered end passes, regular time stops accruing and overtime starts — on any
 * day of the week, since agencies roster regular shifts at weekends too. Work
 * with no roster at all counts entirely as overtime.
 */
export function splitSession(
  session: WorkSession,
  schedules: ScheduleWindow[],
  overtimeEnabled: boolean = true,
  paidBreaks: boolean = false,
  now: number = Date.now()
): {
  regularMs:   number;
  overtimeMs:  number;
  scheduleEnd: string | null;
  otActive:    boolean;   // open shift currently past its rostered end
} {
  const start = new Date(session.in.timestamp).getTime();
  const end   = session.out ? new Date(session.out.timestamp).getTime() : now;

  if (!overtimeEnabled) {
    return { regularMs: session.netMs, overtimeMs: 0, scheduleEnd: null, otActive: false };
  }

  const sched = applicableSchedule(session, schedules);
  if (!sched) {
    return { regularMs: 0, overtimeMs: session.netMs, scheduleEnd: null, otActive: !session.out };
  }

  const boundary = new Date(sched.end_time).getTime();
  const regEnd   = Math.min(end, boundary);
  const otStart  = Math.max(start, boundary);

  let regularMs  = Math.max(0, regEnd - start);
  let overtimeMs = Math.max(0, end - otStart);

  if (!paidBreaks) {
    regularMs  = Math.max(0, regularMs  - breakMsWithin(session, start, regEnd, now));
    overtimeMs = Math.max(0, overtimeMs - breakMsWithin(session, otStart, end, now));
  }

  return {
    regularMs,
    overtimeMs,
    scheduleEnd: sched.end_time,
    otActive:    !session.out && end > boundary,
  };
}

/** Worked milliseconds across sessions, net of breaks. */
export function netMsForLogs(
  logs: ClockEvent[],
  now: number = Date.now(),
  opts: SessionOptions = {}
): number {
  return buildSessions(logs, now, opts).reduce((n, s) => n + s.netMs, 0);
}