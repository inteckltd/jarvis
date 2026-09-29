import { startOfUtcHour } from "./time";

export type MetricSample = {
  capturedAt: Date;
  cpuPercent: number | null;
  memoryPercent: number | null;
  diskPercent: number | null;
  restartCount: number | null;
  dbSizeBytes: bigint | null;
};

export type HourlyRollup = {
  hour: Date;
  avgCpu: number | null;
  maxCpu: number | null;
  avgMemory: number | null;
  maxMemory: number | null;
  avgDisk: number | null;
  maxDisk: number | null;
  restarts: number;
  maxDbSizeBytes: bigint | null;
  sampleCount: number;
};

type Acc = { sum: number; max: number; n: number };

function add(acc: Acc | null, value: number | null): Acc | null {
  if (value === null || Number.isNaN(value)) return acc;
  if (!acc) return { sum: value, max: value, n: 1 };
  return { sum: acc.sum + value, max: Math.max(acc.max, value), n: acc.n + 1 };
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

/**
 * Group samples by UTC hour and compute avg/max per metric.
 * Null values are ignored (a metric that is always null stays null, e.g. disk on DO apps).
 * Output is sorted by hour ascending.
 */
export function rollupHourly(samples: readonly MetricSample[]): HourlyRollup[] {
  const buckets = new Map<
    number,
    {
      cpu: Acc | null;
      mem: Acc | null;
      disk: Acc | null;
      restarts: number;
      maxDb: bigint | null;
      n: number;
    }
  >();

  for (const s of samples) {
    const key = startOfUtcHour(s.capturedAt).getTime();
    const b = buckets.get(key) ?? {
      cpu: null,
      mem: null,
      disk: null,
      restarts: 0,
      maxDb: null,
      n: 0,
    };
    b.cpu = add(b.cpu, s.cpuPercent);
    b.mem = add(b.mem, s.memoryPercent);
    b.disk = add(b.disk, s.diskPercent);
    b.restarts += s.restartCount ?? 0;
    if (s.dbSizeBytes !== null && (b.maxDb === null || s.dbSizeBytes > b.maxDb)) {
      b.maxDb = s.dbSizeBytes;
    }
    b.n += 1;
    buckets.set(key, b);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a - b)
    .map(([key, b]) => ({
      hour: new Date(key),
      avgCpu: b.cpu ? round2(b.cpu.sum / b.cpu.n) : null,
      maxCpu: b.cpu ? round2(b.cpu.max) : null,
      avgMemory: b.mem ? round2(b.mem.sum / b.mem.n) : null,
      maxMemory: b.mem ? round2(b.mem.max) : null,
      avgDisk: b.disk ? round2(b.disk.sum / b.disk.n) : null,
      maxDisk: b.disk ? round2(b.disk.max) : null,
      restarts: b.restarts,
      maxDbSizeBytes: b.maxDb,
      sampleCount: b.n,
    }));
}
