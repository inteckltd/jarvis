import { describe, expect, it } from "vitest";
import { type MetricSample, rollupHourly } from "./rollup";

function sample(iso: string, overrides: Partial<MetricSample> = {}): MetricSample {
  return {
    capturedAt: new Date(iso),
    cpuPercent: null,
    memoryPercent: null,
    diskPercent: null,
    restartCount: null,
    dbSizeBytes: null,
    ...overrides,
  };
}

describe("rollupHourly", () => {
  it("returns an empty array for no samples", () => {
    expect(rollupHourly([])).toEqual([]);
  });

  it("groups by UTC hour and computes avg/max", () => {
    const result = rollupHourly([
      sample("2026-09-01T10:05:00Z", { cpuPercent: 10, memoryPercent: 50 }),
      sample("2026-09-01T10:35:00Z", { cpuPercent: 30, memoryPercent: 70 }),
      sample("2026-09-01T11:00:00Z", { cpuPercent: 80, memoryPercent: 60 }),
    ]);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      hour: new Date("2026-09-01T10:00:00Z"),
      avgCpu: 20,
      maxCpu: 30,
      avgMemory: 60,
      maxMemory: 70,
      sampleCount: 2,
    });
    expect(result[1]).toMatchObject({ avgCpu: 80, maxCpu: 80, sampleCount: 1 });
  });

  it("sorts output by hour even when input is unordered", () => {
    const result = rollupHourly([
      sample("2026-09-01T12:00:00Z", { cpuPercent: 1 }),
      sample("2026-09-01T09:00:00Z", { cpuPercent: 1 }),
    ]);
    expect(result.map((r) => r.hour.toISOString())).toEqual([
      "2026-09-01T09:00:00.000Z",
      "2026-09-01T12:00:00.000Z",
    ]);
  });

  it("keeps metrics that are always null as null (e.g. disk N/A)", () => {
    const [r] = rollupHourly([sample("2026-09-01T10:00:00Z", { cpuPercent: 5 })]);
    expect(r?.avgDisk).toBeNull();
    expect(r?.maxDisk).toBeNull();
  });

  it("ignores nulls when averaging a partially-null metric", () => {
    const [r] = rollupHourly([
      sample("2026-09-01T10:00:00Z", { cpuPercent: 40 }),
      sample("2026-09-01T10:10:00Z", { cpuPercent: null }),
    ]);
    expect(r?.avgCpu).toBe(40);
    expect(r?.sampleCount).toBe(2);
  });

  it("sums restarts and takes max db size", () => {
    const [r] = rollupHourly([
      sample("2026-09-01T10:00:00Z", { restartCount: 1, dbSizeBytes: 100n }),
      sample("2026-09-01T10:15:00Z", { restartCount: 0, dbSizeBytes: 300n }),
      sample("2026-09-01T10:30:00Z", { restartCount: 2, dbSizeBytes: 200n }),
    ]);
    expect(r?.restarts).toBe(3);
    expect(r?.maxDbSizeBytes).toBe(300n);
  });

  it("rounds averages to two decimals", () => {
    const [r] = rollupHourly([
      sample("2026-09-01T10:00:00Z", { cpuPercent: 1 }),
      sample("2026-09-01T10:01:00Z", { cpuPercent: 1 }),
      sample("2026-09-01T10:02:00Z", { cpuPercent: 2 }),
    ]);
    expect(r?.avgCpu).toBe(1.33);
  });
});
