import { DAY_MS, HOUR_MS, MINUTE_MS } from "./time";

export const CHART_RANGES = ["24h", "7d", "30d"] as const;
export type ChartRange = (typeof CHART_RANGES)[number];

export function isChartRange(value: unknown): value is ChartRange {
  return typeof value === "string" && (CHART_RANGES as readonly string[]).includes(value);
}

export type RangeSpec = {
  durationMs: number;
  /** Metric bucket size. 24h reads raw snapshots; longer ranges read hourly rollups. */
  metricBucketMs: number;
  metricSource: "snapshots" | "rollups";
  healthBucketMs: number;
  /** Restart bars are coarser than lines so single events are visible. */
  restartBucketMs: number;
};

export const RANGE_SPEC: Record<ChartRange, RangeSpec> = {
  "24h": {
    durationMs: DAY_MS,
    metricBucketMs: 10 * MINUTE_MS,
    metricSource: "snapshots",
    healthBucketMs: 15 * MINUTE_MS,
    restartBucketMs: HOUR_MS,
  },
  "7d": {
    durationMs: 7 * DAY_MS,
    metricBucketMs: HOUR_MS,
    metricSource: "rollups",
    healthBucketMs: HOUR_MS,
    restartBucketMs: 6 * HOUR_MS,
  },
  "30d": {
    durationMs: 30 * DAY_MS,
    metricBucketMs: 4 * HOUR_MS,
    metricSource: "rollups",
    healthBucketMs: 6 * HOUR_MS,
    restartBucketMs: DAY_MS,
  },
};

/** Postgres interval literal for a bucket size, e.g. "900 seconds". */
export function intervalLiteral(ms: number): string {
  return `${Math.round(ms / 1000)} seconds`;
}

/** Start of the bucket containing `t`, aligned to the Unix epoch (matches date_bin with epoch origin). */
export function bucketStart(t: number, bucketMs: number): number {
  return Math.floor(t / bucketMs) * bucketMs;
}

/**
 * One entry per bucket from `from` to `to`; buckets with no data get `empty(t)` so
 * chart lines break at gaps instead of drawing a straight line across them.
 */
export function fillBuckets<T extends { t: number }>(
  points: readonly T[],
  from: number,
  to: number,
  bucketMs: number,
  empty: (t: number) => T,
): T[] {
  const byT = new Map(points.map((p) => [p.t, p]));
  const out: T[] = [];
  for (let t = bucketStart(from, bucketMs); t <= to; t += bucketMs) {
    out.push(byT.get(t) ?? empty(t));
  }
  return out;
}

/** Total uptime % over health buckets, 2 dp rounded down; null without checks. */
export function uptimeFromBuckets(
  buckets: readonly { up: number; total: number }[],
): number | null {
  let up = 0;
  let total = 0;
  for (const b of buckets) {
    up += b.up;
    total += b.total;
  }
  if (total === 0) return null;
  return Math.floor((up / total) * 10_000) / 100;
}

/** Summary of a numeric series ignoring nulls. */
export function seriesStats(values: readonly (number | null)[]): {
  avg: number | null;
  max: number | null;
} {
  let sum = 0;
  let n = 0;
  let max: number | null = null;
  for (const v of values) {
    if (v === null || Number.isNaN(v)) continue;
    sum += v;
    n += 1;
    if (max === null || v > max) max = v;
  }
  return { avg: n ? Math.round((sum / n) * 10) / 10 : null, max };
}
