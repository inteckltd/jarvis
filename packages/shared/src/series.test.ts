import { describe, expect, it } from "vitest";
import {
  bucketStart,
  fillBuckets,
  intervalLiteral,
  RANGE_SPEC,
  seriesStats,
  uptimeFromBuckets,
} from "./series";

const H = 3_600_000;

describe("bucketStart", () => {
  it("aligns to the epoch", () => {
    const t = Date.UTC(2026, 8, 29, 10, 47);
    expect(new Date(bucketStart(t, H)).toISOString()).toBe("2026-09-29T10:00:00.000Z");
    expect(new Date(bucketStart(t, 15 * 60_000)).toISOString()).toBe("2026-09-29T10:45:00.000Z");
  });
});

describe("fillBuckets", () => {
  it("inserts empty buckets for gaps", () => {
    const from = Date.UTC(2026, 8, 29, 0, 20);
    const to = Date.UTC(2026, 8, 29, 3, 10);
    const t0 = Date.UTC(2026, 8, 29, 0);
    const pts = [
      { t: t0, v: 1 as number | null },
      { t: t0 + 2 * H, v: 3 as number | null },
    ];
    const out = fillBuckets(pts, from, to, H, (t) => ({ t, v: null }));
    expect(out.map((p) => p.v)).toEqual([1, null, 3, null]);
    expect(out[0]?.t).toBe(t0);
  });
});

describe("uptimeFromBuckets", () => {
  it("sums checks across buckets", () => {
    expect(
      uptimeFromBuckets([
        { up: 60, total: 60 },
        { up: 45, total: 60 },
      ]),
    ).toBe(87.5);
    expect(uptimeFromBuckets([])).toBeNull();
  });
});

describe("seriesStats", () => {
  it("ignores nulls", () => {
    expect(seriesStats([10, null, 20, 33])).toEqual({ avg: 21, max: 33 });
    expect(seriesStats([null])).toEqual({ avg: null, max: null });
  });
});

describe("ranges", () => {
  it("keeps charts to a sensible number of points", () => {
    for (const spec of Object.values(RANGE_SPEC)) {
      expect(spec.durationMs / spec.metricBucketMs).toBeLessThanOrEqual(200);
      expect(spec.durationMs / spec.healthBucketMs).toBeLessThanOrEqual(200);
    }
    expect(intervalLiteral(15 * 60_000)).toBe("900 seconds");
  });
});
