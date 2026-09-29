import { isLondonWeekend, londonHour, MINUTE_MS } from "@jarvis/shared";

/**
 * Relative load for a business system used during UK working hours:
 * ~0 overnight, peaking mid-afternoon, much lower at weekends.
 */
export function workload(date: Date): number {
  const h = londonHour(date) + date.getUTCMinutes() / 60;
  const weekday = isLondonWeekend(date) ? 0.25 : 1;
  if (h < 7 || h > 19) return 0.04 * weekday;
  return Math.max(0.04, Math.sin((Math.PI * (h - 7)) / 12)) * weekday;
}

/** Sample times from `from` to `to` (inclusive of `from`, exclusive of `to`) at a fixed step. */
export function timeline(from: Date, to: Date, stepMinutes: number): Date[] {
  const out: Date[] = [];
  const step = stepMinutes * MINUTE_MS;
  for (let t = from.getTime(); t < to.getTime(); t += step) out.push(new Date(t));
  return out;
}

/** Round down to a multiple of `minutes`. */
export function floorToMinutes(date: Date, minutes: number): Date {
  const step = minutes * MINUTE_MS;
  return new Date(Math.floor(date.getTime() / step) * step);
}
