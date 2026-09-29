import { type Prisma } from "@prisma/client";
import { DAY_MS, HOUR_MS, type MetricSample } from "@jarvis/shared";
import { ago, type SeedContext } from "../context";
import { clamp, createRng, seedFrom } from "../random";
import { floorToMinutes, timeline, workload } from "../time";

export type SnapshotRow = Prisma.MetricSnapshotCreateManyInput;

/** 15-minute samples for the month, 5-minute samples for the last 24 hours. */
export function metricTimeline(ctx: SeedContext): Date[] {
  const recent = ago(ctx, DAY_MS);
  const end = new Date(floorToMinutes(ctx.now, 5).getTime() + 1);
  return [...timeline(ctx.start, recent, 15), ...timeline(recent, end, 5)];
}

export type AppProfile = {
  cpuBase: number;
  cpuPeak: number;
  memBase: number;
  /** Percentage points of memory growth per day since the last deploy/restart. */
  memGrowthPerDay: number;
  memMax: number;
  /** Optional sustained memory pressure from `from` onwards, peaking at `peak` during working hours. */
  memPressure?: { from: Date; floor: number; peak: number };
};

function latestBefore(times: readonly Date[], t: Date): Date | null {
  let best: Date | null = null;
  for (const x of times) {
    if (x <= t && (best === null || x > best)) best = x;
  }
  return best;
}

function countBetween(times: readonly Date[], after: Date | null, upTo: Date): number {
  let n = 0;
  for (const x of times) {
    if (x <= upTo && (after === null || x > after)) n++;
  }
  return n;
}

/** DigitalOcean App Platform component: CPU, memory, restarts. Disk is N/A (null). */
export function doAppSnapshots(
  ctx: SeedContext,
  resourceId: string,
  profile: AppProfile,
  deployTimes: readonly Date[],
  restartTimes: readonly Date[],
  seedLabel: string,
): { rows: SnapshotRow[]; samples: MetricSample[] } {
  const rng = createRng(seedFrom(seedLabel));
  const resets = [...deployTimes, ...restartTimes];
  const rows: SnapshotRow[] = [];
  const samples: MetricSample[] = [];
  let prev: Date | null = null;

  for (const t of metricTimeline(ctx)) {
    const load = workload(t);
    const cpu = clamp(
      profile.cpuBase + (profile.cpuPeak - profile.cpuBase) * load + rng.gaussian(0, 1.8),
      0.5,
      100,
    );

    const lastReset = latestBefore(resets, t) ?? ctx.start;
    const daysSince = (t.getTime() - lastReset.getTime()) / DAY_MS;
    let memory = clamp(
      profile.memBase + profile.memGrowthPerDay * daysSince + 6 * load + rng.gaussian(0, 0.8),
      5,
      profile.memMax,
    );
    if (profile.memPressure && t >= profile.memPressure.from) {
      const { floor, peak } = profile.memPressure;
      memory = Math.max(
        memory,
        clamp(floor + (peak - floor) * load + rng.gaussian(0, 0.4), 0, peak),
      );
    }

    const restarts = countBetween(restartTimes, prev, t);
    prev = t;

    const sample: MetricSample = {
      capturedAt: t,
      cpuPercent: round1(cpu),
      memoryPercent: round1(memory),
      diskPercent: null,
      restartCount: restarts,
      dbSizeBytes: null,
    };
    samples.push(sample);
    rows.push({ resourceId, ...sample });
  }
  return { rows, samples };
}

export type DbProfile = {
  cpuBase: number;
  cpuPeak: number;
  memBase: number;
  connBase: number;
  connPeak: number;
  sizeStartBytes: number;
  sizeEndBytes: number;
  diskSizeBytes: number;
  /** WAL, indexes, system catalogs etc. on top of logical DB size. */
  overheadBytes: number;
};

/** Supabase Postgres: CPU, memory, disk, connections and database size. */
export function supabaseDbSnapshots(
  ctx: SeedContext,
  resourceId: string,
  profile: DbProfile,
  seedLabel: string,
): { rows: SnapshotRow[]; samples: MetricSample[] } {
  const rng = createRng(seedFrom(seedLabel));
  const rows: SnapshotRow[] = [];
  const samples: MetricSample[] = [];
  const span = ctx.now.getTime() - ctx.start.getTime();

  for (const t of metricTimeline(ctx)) {
    const load = workload(t);
    const progress = (t.getTime() - ctx.start.getTime()) / span;
    const size = Math.round(
      profile.sizeStartBytes +
        (profile.sizeEndBytes - profile.sizeStartBytes) * progress +
        rng.float(0, 2e5),
    );
    const disk = ((size + profile.overheadBytes) / profile.diskSizeBytes) * 100;
    const cpu = clamp(
      profile.cpuBase + (profile.cpuPeak - profile.cpuBase) * load + rng.gaussian(0, 1.2),
      0.5,
      100,
    );
    const memory = clamp(profile.memBase + 5 * load + rng.gaussian(0, 0.6), 5, 100);
    const connections = Math.max(
      1,
      Math.round(profile.connBase + profile.connPeak * load + rng.gaussian(0, 1.5)),
    );

    const sample: MetricSample = {
      capturedAt: t,
      cpuPercent: round1(cpu),
      memoryPercent: round1(memory),
      diskPercent: round1(disk),
      restartCount: null,
      dbSizeBytes: BigInt(size),
    };
    samples.push(sample);
    rows.push({ resourceId, ...sample, dbConnections: connections });
  }
  return { rows, samples };
}

/** Restart timestamps for a resource. `recent` controls whether one lands in the last 24h. */
export function restartTimes(
  ctx: SeedContext,
  daysAgo: readonly number[],
  hoursAgo: readonly number[],
): Date[] {
  return [
    ...daysAgo.map((d) => ago(ctx, d * DAY_MS)),
    ...hoursAgo.map((h) => ago(ctx, h * HOUR_MS)),
  ];
}

export function randomRestarts(ctx: SeedContext, count: number, seedLabel: string): Date[] {
  const rng = createRng(seedFrom(seedLabel));
  const span = ctx.now.getTime() - ctx.start.getTime();
  return Array.from({ length: count }, () => new Date(ctx.start.getTime() + rng.next() * span));
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}
