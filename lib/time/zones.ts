/**
 * Timezone-correct conversion between a wall-clock time in a named IANA zone
 * and a UTC instant.
 *
 * `new Date("2026-07-19T09:00")` parses in the BROWSER's zone, so a manager in
 * Lagos rostering "09:00 America/New_York" would store 09:00 Lagos — five hours
 * out. These helpers resolve the wall clock against the zone the user actually
 * picked, wherever they happen to be sitting.
 */

/** What a UTC instant reads as, as wall-clock numbers, in a given zone. */
function partsInZone(instant: Date, timeZone: string) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year:   "numeric",
    month:  "2-digit",
    day:    "2-digit",
    hour:   "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const map: Record<string, number> = {};
  for (const p of dtf.formatToParts(instant)) {
    if (p.type !== "literal") map[p.type] = parseInt(p.value, 10);
  }
  // Intl renders midnight as hour 24 in some engines.
  if (map.hour === 24) map.hour = 0;
  return map;
}

/** The zone's UTC offset, in ms, at a given instant (DST-aware). */
function offsetMsAt(instant: Date, timeZone: string): number {
  const p = partsInZone(instant, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - instant.getTime();
}

/**
 * Convert a wall clock in `timeZone` to the correct UTC instant.
 *
 * @param dateStr "YYYY-MM-DD"
 * @param timeStr "HH:mm" (or "HH:mm:ss")
 * @param timeZone IANA name, e.g. "America/New_York". Falls back to the
 *                 browser's zone when missing or invalid.
 */
export function zonedWallClockToUtc(
  dateStr: string,
  timeStr: string,
  timeZone?: string | null
): Date {
  const zone = timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [y, m, d]  = dateStr.split("-").map(Number);
  const [hh, mm, ss = 0] = timeStr.split(":").map(Number);

  // Start by reading the wall clock as if it were UTC, then correct by the
  // zone's offset. A second pass settles DST boundaries, where the offset at
  // the guessed instant differs from the offset at the true one.
  const guess = new Date(Date.UTC(y, m - 1, d, hh, mm, ss));
  try {
    let result = new Date(guess.getTime() - offsetMsAt(guess, zone));
    const settled = new Date(guess.getTime() - offsetMsAt(result, zone));
    if (settled.getTime() !== result.getTime()) result = settled;
    return result;
  } catch {
    // Unknown zone: fall back to browser-local parsing rather than throwing.
    return new Date(`${dateStr}T${timeStr}`);
  }
}

/** Render a UTC instant as wall-clock time in a named zone. */
export function formatInZone(
  iso: string,
  timeZone?: string | null,
  opts: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" }
): string {
  const zone = timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  try {
    return new Intl.DateTimeFormat(undefined, { ...opts, timeZone: zone }).format(new Date(iso));
  } catch {
    return new Intl.DateTimeFormat(undefined, opts).format(new Date(iso));
  }
}

/** Short zone label, e.g. "GMT+1" — for showing which zone a time belongs to. */
export function zoneAbbr(timeZone?: string | null, at: Date = new Date()): string {
  const zone = timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "shortOffset" })
      .formatToParts(at);
    return parts.find((p) => p.type === "timeZoneName")?.value ?? zone;
  } catch {
    return zone;
  }
}