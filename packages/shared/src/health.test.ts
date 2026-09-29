import { describe, expect, it } from "vitest";
import {
  clientStatus,
  evaluateResource,
  percentStatus,
  type ResourceSignals,
  restartStatus,
  uptimePercent,
  worstStatus,
} from "./health";

const now = new Date("2026-09-29T08:00:00Z");
const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000);

function doApp(overrides: Partial<ResourceSignals> = {}): ResourceSignals {
  return {
    type: "DO_APP",
    environment: "PRODUCTION",
    metrics: { cpuPercent: 20, memoryPercent: 40, diskPercent: null, capturedAt: minutesAgo(3) },
    restarts: 0,
    latestDeployment: { status: "SUCCESS" },
    hasHealthCheck: true,
    latestHealth: { isUp: true, statusCode: 200, checkedAt: minutesAgo(1) },
    lastError: null,
    now,
    ...overrides,
  };
}

describe("thresholds", () => {
  it("uses warning >= 75 and critical >= 90", () => {
    expect(percentStatus(74.9)).toBe("healthy");
    expect(percentStatus(75)).toBe("warning");
    expect(percentStatus(89.9)).toBe("warning");
    expect(percentStatus(90)).toBe("critical");
    expect(percentStatus(null)).toBe("nodata");
  });

  it("accepts custom thresholds", () => {
    expect(percentStatus(60, { warning: 50, critical: 80 })).toBe("warning");
  });

  it("restarts: any = amber, 3+ = red", () => {
    expect(restartStatus(0)).toBe("healthy");
    expect(restartStatus(1)).toBe("warning");
    expect(restartStatus(2)).toBe("warning");
    expect(restartStatus(3)).toBe("critical");
    expect(restartStatus(null)).toBe("nodata");
  });
});

describe("worstStatus", () => {
  it("ranks critical > warning > healthy", () => {
    expect(worstStatus(["healthy", "warning", "critical"])).toBe("critical");
    expect(worstStatus(["healthy", "warning"])).toBe("warning");
  });

  it("never lets missing data mask a real reading", () => {
    expect(worstStatus(["nodata", "healthy"])).toBe("healthy");
    expect(worstStatus(["nodata"])).toBe("nodata");
    expect(worstStatus([])).toBe("nodata");
  });
});

describe("uptimePercent", () => {
  it("rounds down so 1 failure in 10,000 is not shown as 100%", () => {
    expect(uptimePercent(9_999, 10_000)).toBe(99.99);
    expect(uptimePercent(99_999, 100_000)).toBe(99.99);
    expect(uptimePercent(10, 10)).toBe(100);
  });

  it("returns null without checks", () => {
    expect(uptimePercent(0, 0)).toBeNull();
  });
});

describe("evaluateResource", () => {
  it("is healthy when everything is fine and treats DO disk as N/A", () => {
    const r = evaluateResource(doApp());
    expect(r.status).toBe("healthy");
    expect(r.disk).toBeNull();
    expect(r.reasons).toEqual([]);
  });

  it("turns amber on high memory", () => {
    const r = evaluateResource(
      doApp({
        metrics: {
          cpuPercent: 20,
          memoryPercent: 78.4,
          diskPercent: null,
          capturedAt: minutesAgo(2),
        },
      }),
    );
    expect(r.status).toBe("warning");
    expect(r.memory).toBe("warning");
    expect(r.reasons).toEqual([{ status: "warning", message: "Memory at 78%" }]);
  });

  it("turns amber on one restart and red on three", () => {
    expect(evaluateResource(doApp({ restarts: 1 })).status).toBe("warning");
    const red = evaluateResource(doApp({ restarts: 3 }));
    expect(red.status).toBe("critical");
    expect(red.reasons[0]).toEqual({ status: "critical", message: "3 restarts in 24h" });
  });

  it("is red when the latest deployment failed", () => {
    const r = evaluateResource(doApp({ latestDeployment: { status: "FAILED" } }));
    expect(r.status).toBe("critical");
    expect(r.reasons[0]?.message).toBe("Latest deployment failed");
  });

  it("is red when the health check is down", () => {
    const r = evaluateResource(
      doApp({ latestHealth: { isUp: false, statusCode: 503, checkedAt: minutesAgo(1) } }),
    );
    expect(r.status).toBe("critical");
    expect(r.reasons[0]?.message).toBe("Health check down (HTTP 503)");
  });

  it("ignores stale metrics and says so", () => {
    const r = evaluateResource(
      doApp({
        metrics: {
          cpuPercent: 99,
          memoryPercent: 99,
          diskPercent: null,
          capturedAt: minutesAgo(180),
        },
      }),
    );
    expect(r.cpu).toBe("nodata");
    expect(r.metricsFresh).toBe(false);
    expect(r.status).toBe("healthy");
    expect(r.reasons).toContainEqual({ status: "nodata", message: "No metrics for 3h" });
  });

  it("is grey when nothing has reported", () => {
    const r = evaluateResource(
      doApp({ metrics: null, restarts: null, latestDeployment: null, latestHealth: null }),
    );
    expect(r.status).toBe("nodata");
    expect(r.reasons.map((x) => x.message)).toEqual(["No metrics yet", "No health checks yet"]);
  });

  it("checks disk for Supabase databases", () => {
    const r = evaluateResource({
      ...doApp(),
      type: "SUPABASE_PROJECT",
      metrics: { cpuPercent: 10, memoryPercent: 50, diskPercent: 91, capturedAt: minutesAgo(1) },
      restarts: null,
      latestDeployment: null,
      hasHealthCheck: false,
      latestHealth: null,
    });
    expect(r.status).toBe("critical");
    expect(r.restarts).toBeNull();
    expect(r.reasons[0]?.message).toBe("Disk at 91%");
  });
});

describe("edge functions", () => {
  const fn = (functions: ResourceSignals["functions"]) =>
    evaluateResource({
      ...doApp(),
      type: "SUPABASE_FUNCTIONS",
      metrics: null,
      restarts: null,
      latestDeployment: null,
      hasHealthCheck: false,
      latestHealth: null,
      functions,
    });

  it("is healthy with recent stats and grey without", () => {
    expect(fn({ invocations: 8000, errors: 40 }).status).toBe("healthy");
    const none = fn(null);
    expect(none.status).toBe("nodata");
    expect(none.reasons[0]?.message).toBe("No function stats in 24h");
  });
});

describe("clientStatus", () => {
  it("is driven by production only", () => {
    expect(
      clientStatus([
        { environment: "PRODUCTION", status: "healthy" },
        { environment: "DEVELOPMENT", status: "critical" },
      ]),
    ).toBe("healthy");
    expect(
      clientStatus([
        { environment: "PRODUCTION", status: "healthy" },
        { environment: "PRODUCTION", status: "warning" },
      ]),
    ).toBe("warning");
  });

  it("is grey with no production resources", () => {
    expect(clientStatus([{ environment: "DEVELOPMENT", status: "healthy" }])).toBe("nodata");
  });
});
