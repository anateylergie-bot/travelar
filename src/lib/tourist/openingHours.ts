// Structured opening-hours shape (spec Section 123 - "use structured data
// rather than free text"). Keys are lowercase 3-letter day abbreviations;
// a missing or null day means closed that day. Times are "HH:MM" 24h,
// interpreted in one app-wide timezone - see DECISIONS.md D26 for why
// this isn't yet per-place timezone-aware.

export type DayOfWeek = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export interface DayHours {
  open: string; // "HH:MM"
  close: string; // "HH:MM"
}

export type OpeningHours = Partial<Record<DayOfWeek, DayHours | null>>;

const DAY_KEYS: DayOfWeek[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function parseMinutes(hhmm: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/**
 * Evaluates whether a place is open at `now`, interpreted in
 * `timezoneOffsetMinutes` (minutes ahead of UTC — e.g. 0 for Ghana/UTC).
 * Returns null (not true/false) when opening hours simply aren't known,
 * since "closed" and "unknown" are different claims and callers should
 * not conflate them (spec Section 96: never assert something unverified).
 */
export function isOpenNow(
  openingHours: OpeningHours | null | undefined,
  now: Date,
  timezoneOffsetMinutes = 0
): boolean | null {
  if (!openingHours) return null;

  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const localMinutes = ((utcMinutes + timezoneOffsetMinutes) % 1440 + 1440) % 1440;
  const dayShift = Math.floor((utcMinutes + timezoneOffsetMinutes) / 1440);
  const localDayIndex = ((now.getUTCDay() + dayShift) % 7 + 7) % 7;
  const dayKey = DAY_KEYS[localDayIndex];

  const hours = openingHours[dayKey];
  if (hours === undefined) return null; // day not specified at all - unknown
  if (hours === null) return false; // explicitly closed that day

  const openMin = parseMinutes(hours.open);
  const closeMin = parseMinutes(hours.close);
  if (openMin === null || closeMin === null) return null; // malformed data - unknown, not false

  if (openMin === closeMin) return false; // zero-length window, treat as closed
  if (openMin < closeMin) {
    return localMinutes >= openMin && localMinutes < closeMin;
  }
  // Overnight window (e.g. 20:00-02:00)
  return localMinutes >= openMin || localMinutes < closeMin;
}

export function getDefaultTimezoneOffsetMinutes(): number {
  const tz = process.env.DEFAULT_TIMEZONE ?? "UTC";
  // Only UTC (offset 0) is supported without a timezone database. This is
  // deliberately explicit rather than silently wrong for other values -
  // see DECISIONS.md D26.
  if (tz !== "UTC") {
    throw new Error(`DEFAULT_TIMEZONE="${tz}" is not supported yet - only "UTC" (offset 0) is implemented.`);
  }
  return 0;
}
