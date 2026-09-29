import { DAY_MS, HOUR_MS, MINUTE_MS } from "./time";

/** "just now", "12 min ago", "3h ago", "2 days ago". */
export function formatAgo(date: Date, now: Date = new Date()): string {
  const ms = now.getTime() - date.getTime();
  if (ms < MINUTE_MS) return "just now";
  if (ms < HOUR_MS) return `${Math.floor(ms / MINUTE_MS)} min ago`;
  if (ms < DAY_MS) return `${Math.floor(ms / HOUR_MS)}h ago`;
  const days = Math.floor(ms / DAY_MS);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

const UNITS = ["B", "KB", "MB", "GB", "TB"] as const;

/** Binary units, 1 decimal above KB: 1.34 GiB -> "1.3 GB". */
export function formatBytes(bytes: number): string {
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const digits = unit <= 1 ? 0 : 1;
  return `${value.toFixed(digits)} ${UNITS[unit]}`;
}

/** 12400 -> "12.4k". */
export function formatCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}
