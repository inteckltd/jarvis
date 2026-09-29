import { TIMEZONE } from "./constants";

const londonDateTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIMEZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const londonTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIMEZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const londonHourFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIMEZONE,
  hour: "numeric",
  hour12: false,
});

const londonWeekdayFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIMEZONE,
  weekday: "short",
});

const londonDayKeyFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export const BRIEFING_GREETING = "Good morning. Here's your briefing.";

/** "Tuesday 29 September 2026" in Europe/London. */
export function formatLondonDate(date: Date): string {
  return londonDateTime.format(date).replace(",", "");
}

/** "10:32" (24h) in Europe/London. */
export function formatLondonTime(date: Date): string {
  return londonTime.format(date);
}

const londonShort = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIMEZONE,
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** "29 Sep 2026, 10:32" in Europe/London. */
export function formatLondonDateTime(date: Date): string {
  return londonShort.format(date);
}

/** Hour of day 0–23 in Europe/London. */
export function londonHour(date: Date): number {
  return Number(londonHourFmt.format(date)) % 24;
}

/** True for Saturday/Sunday in Europe/London. */
export function isLondonWeekend(date: Date): boolean {
  const day = londonWeekdayFmt.format(date);
  return day === "Sat" || day === "Sun";
}

/** "YYYY-MM-DD" calendar day in Europe/London. */
export function londonDayKey(date: Date): string {
  return londonDayKeyFmt.format(date);
}

function londonYmd(date: Date): [number, number, number] {
  const [y, m, d] = londonDayKey(date).split("-").map(Number);
  if (y === undefined || m === undefined || d === undefined) throw new Error("Invalid date");
  return [y, m, d];
}

/**
 * Date-only values (e.g. task due dates) are stored as 12:00 UTC on the London
 * calendar day, so they fall on the same day in London under both GMT and BST.
 */
export function londonDateOnly(date: Date, offsetDays = 0): Date {
  const [y, m, d] = londonYmd(date);
  return new Date(Date.UTC(y, m - 1, d + offsetDays, 12, 0, 0));
}

/** UTC range [start, end) that contains every date-only value for the London day of `date`. */
export function londonDateOnlyBounds(date: Date): { start: Date; end: Date } {
  const [y, m, d] = londonYmd(date);
  return { start: new Date(Date.UTC(y, m - 1, d)), end: new Date(Date.UTC(y, m - 1, d + 1)) };
}

/** Truncate to the start of the UTC hour. */
export function startOfUtcHour(date: Date): Date {
  const d = new Date(date);
  d.setUTCMinutes(0, 0, 0);
  return d;
}

export const MINUTE_MS = 60_000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;
