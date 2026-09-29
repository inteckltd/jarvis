import { describe, expect, it } from "vitest";
import {
  createDigitalOceanAppCollector,
  type DoDeployment,
  mapDoDeployment,
  mapDoPhase,
  mergeAppMetrics,
  toInstanceSeries,
} from "../src/integrations/digitalocean-apps";
import { type FetchFn, ProviderError } from "../src/integrations/http";

const TOKEN = "dop_v1_super_secret_token";
const cred = { token: TOKEN, teamId: null };
const resource = { id: "r1", externalId: "app-123", config: { componentName: "api" } };

function fakeFetch(route: (url: URL) => { status?: number; body: unknown }) {
  const calls: URL[] = [];
  const fn: FetchFn = async (input) => {
    const url = new URL(String(input));
    calls.push(url);
    const { status = 200, body } = route(url);
    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  };
  return { fn, calls };
}

const matrix = (series: Array<{ instance: string; values: Array<[number, string]> }>) => ({
  status: "success",
  data: {
    resultType: "matrix",
    result: series.map((s) => ({
      metric: { app_component: "api", app_component_instance: s.instance, app_uuid: "app-123" },
      values: s.values,
    })),
  },
});

describe("DigitalOcean App Platform metrics", () => {
  it("takes the busiest instance and turns restart counters into deltas", () => {
    const series = (a: string[], b: string[]) =>
      toInstanceSeries(
        matrix([
          { instance: "api-0", values: a.map((v, i) => [1000 + i * 120, v]) },
          { instance: "api-1", values: b.map((v, i) => [1000 + i * 120, v]) },
        ]),
      );
    const samples = mergeAppMetrics({
      cpu: series(["10", "20", "30"], ["15", "5", "NaN"]),
      memory: series(["40", "41", "42"], ["50", "51", "52"]),
      // api-0 restarts twice between samples 1 and 2; api-1 is replaced (counter drops).
      restarts: series(["1", "1", "3"], ["4", "0", "0"]),
    });

    expect(samples).toEqual([
      {
        capturedAt: new Date(1_000_000),
        cpuPercent: 15,
        memoryPercent: 50,
        diskPercent: null,
        restartCount: 0,
      },
      {
        capturedAt: new Date(1_120_000),
        cpuPercent: 20,
        memoryPercent: 51,
        diskPercent: null,
        restartCount: 0,
      },
      {
        capturedAt: new Date(1_240_000),
        cpuPercent: 30,
        memoryPercent: 52,
        diskPercent: null,
        restartCount: 2,
      },
    ]);
  });

  it("leaves a metric null where DO reported nothing", () => {
    const samples = mergeAppMetrics({
      cpu: toInstanceSeries(matrix([{ instance: "a", values: [[60, "12.3456"]] }])),
      memory: [],
      restarts: [],
    });
    expect(samples).toEqual([
      {
        capturedAt: new Date(60_000),
        cpuPercent: 12.35,
        memoryPercent: null,
        diskPercent: null,
        restartCount: null,
      },
    ]);
  });

  it("queries the three monitoring endpoints for the configured component", async () => {
    const { fn, calls } = fakeFetch((url) =>
      url.pathname.endsWith("restart_count")
        ? { body: matrix([{ instance: "a", values: [[60, "0"]] }]) }
        : { body: matrix([{ instance: "a", values: [[60, "5"]] }]) },
    );
    const from = new Date("2026-09-29T10:00:00Z");
    const to = new Date("2026-09-29T10:05:00Z");
    const samples = await createDigitalOceanAppCollector(fn).metrics?.getMetrics(
      cred,
      resource,
      from,
      to,
    );

    expect(calls.map((u) => u.pathname).sort()).toEqual([
      "/v2/monitoring/metrics/apps/cpu_percentage",
      "/v2/monitoring/metrics/apps/memory_percentage",
      "/v2/monitoring/metrics/apps/restart_count",
    ]);
    expect(Object.fromEntries(calls[0]?.searchParams ?? [])).toEqual({
      app_id: "app-123",
      app_component: "api",
      start: String(from.getTime() / 1000),
      end: String(to.getTime() / 1000),
    });
    expect(samples).toHaveLength(1);
  });

  it("surfaces provider failures as ProviderError without the token", async () => {
    const { fn } = fakeFetch(() => ({ status: 403, body: { message: "missing monitoring:read" } }));
    const error = await createDigitalOceanAppCollector(fn)
      .metrics?.getMetrics(cred, resource, new Date(0), new Date(1000))
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ProviderError);
    expect(String((error as Error).message)).toContain("missing monitoring:read");
    expect(String((error as Error).message)).not.toContain(TOKEN);
  });
});

describe("DigitalOcean App Platform deployments", () => {
  const deployment = (over: Partial<DoDeployment> = {}): DoDeployment => ({
    id: "dep-1",
    phase: "ACTIVE",
    cause: "commit e618bff pushed to github.com/acme/api/tree/main",
    created_at: "2026-09-25T08:30:08Z",
    phase_last_updated_at: "2026-09-25T08:32:18Z",
    services: [
      { name: "worker", source_commit_hash: "aaa" },
      { name: "api", source_commit_hash: "e618bff3ec39" },
    ],
    spec: { services: [{ name: "api", github: { repo: "acme/api", branch: "main" } }] },
    progress: {
      steps: [{ ended_at: "2026-09-25T08:32:00Z" }, { ended_at: "0001-01-01T00:00:00Z" }],
    },
    ...over,
  });

  it("maps DO phases", () => {
    expect(mapDoPhase("ACTIVE")).toBe("SUCCESS");
    expect(mapDoPhase("SUPERSEDED")).toBe("SUCCESS");
    expect(mapDoPhase("ERROR")).toBe("FAILED");
    expect(mapDoPhase("CANCELED")).toBe("CANCELED");
    for (const p of ["PENDING_BUILD", "BUILDING", "PENDING_DEPLOY", "DEPLOYING", "UNKNOWN"]) {
      expect(mapDoPhase(p)).toBe("BUILDING");
    }
  });

  it("maps the configured component's commit, branch and timings", () => {
    expect(mapDoDeployment(deployment(), { appId: "app-123", componentName: "api" })).toEqual({
      externalId: "dep-1",
      status: "SUCCESS",
      cause: "commit e618bff pushed to github.com/acme/api/tree/main",
      commitSha: "e618bff3ec39",
      commitMessage: null,
      branch: "main",
      url: "https://cloud.digitalocean.com/apps/app-123/deployments/dep-1",
      startedAt: new Date("2026-09-25T08:30:08Z"),
      finishedAt: new Date("2026-09-25T08:32:00Z"),
    });
  });

  it("reads git push details defensively and falls back to the cause for the branch", () => {
    const mapped = mapDoDeployment(
      deployment({
        phase: "DEPLOYING",
        services: [],
        spec: undefined,
        cause: "commit 1a2b3c4 pushed to github.com/acme/api/tree/pre-production",
        cause_details: { git_push: { commit_sha: "1a2b3c4d", commit_message: " Fix login " } },
      }),
      { appId: "app-123", componentName: "api" },
    );
    expect(mapped).toMatchObject({
      status: "BUILDING",
      commitSha: "1a2b3c4d",
      commitMessage: "Fix login",
      branch: "pre-production",
      finishedAt: null,
    });

    const odd = mapDoDeployment(deployment({ cause_details: "unexpected" }), {
      appId: "a",
      componentName: "api",
    });
    expect(odd.commitMessage).toBeNull();
  });

  it("pages back until it reaches deployments older than `since`", async () => {
    const page = (ids: Array<[string, string]>, next: boolean) => ({
      deployments: ids.map(([id, created_at]) => ({ id, phase: "SUPERSEDED", created_at })),
      links: next ? { pages: { next: "x" } } : {},
    });
    const { fn, calls } = fakeFetch((url) =>
      url.searchParams.get("page") === "1"
        ? {
            body: page(
              [
                ["d3", "2026-09-28T00:00:00Z"],
                ["d2", "2026-09-20T00:00:00Z"],
              ],
              true,
            ),
          }
        : { body: page([["d1", "2026-09-01T00:00:00Z"]], true) },
    );
    const since = new Date("2026-09-15T00:00:00Z");
    const list = await createDigitalOceanAppCollector(fn).deployments?.listDeployments(
      cred,
      resource,
      since,
    );
    expect(list?.map((d) => d.externalId)).toEqual(["d3", "d2"]);
    expect(calls).toHaveLength(2);
    expect(calls[0]?.pathname).toBe("/v2/apps/app-123/deployments");
  });
});
