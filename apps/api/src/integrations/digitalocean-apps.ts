import { z } from "zod";
import { DO_API_BASE, doComponentSchema } from "./digitalocean";
import { type FetchFn, requestJson } from "./http";
import {
  type CollectedDeployment,
  type CollectedSample,
  type CollectorResource,
  type ResourceCollector,
} from "./types";

const PROVIDER = "DigitalOcean";
const DEPLOYMENTS_PER_PAGE = 50;
const MAX_DEPLOYMENT_PAGES = 10;

const doAppConfigSchema = z.object({ componentName: z.string().min(1).optional() });

/** The App Platform component Resource.config points at, if any. */
export function doComponentName(config: unknown): string | null {
  const parsed = doAppConfigSchema.safeParse(config);
  return parsed.success ? (parsed.data.componentName ?? null) : null;
}

// ─── Metrics ────────────────────────────────────────────────────────────────

const sampleValue = z.union([z.number(), z.string()]);

const matrixSchema = z.object({
  data: z.object({
    result: z.array(
      z.object({
        metric: z.record(z.string(), z.string()),
        values: z.array(z.tuple([sampleValue, sampleValue])),
      }),
    ),
  }),
});

type Matrix = z.infer<typeof matrixSchema>;

/** One instance's time series: unix seconds → value (NaN / unparsable points dropped). */
export type InstanceSeries = { instance: string; points: Array<[number, number]> };

export function toInstanceSeries(matrix: Matrix): InstanceSeries[] {
  return matrix.data.result.map((series, index) => ({
    instance: series.metric.app_component_instance ?? series.metric.app_component ?? `#${index}`,
    points: series.values
      .map(([t, v]): [number, number] => [Number(t), Number(v)])
      .filter(([t, v]) => Number.isFinite(t) && Number.isFinite(v))
      .sort(([a], [b]) => a - b),
  }));
}

/** Largest value across instances at each timestamp (the busiest instance drives status). */
function maxByTimestamp(series: readonly InstanceSeries[]): Map<number, number> {
  const out = new Map<number, number>();
  for (const s of series) {
    for (const [t, v] of s.points) {
      const current = out.get(t);
      out.set(t, current === undefined ? v : Math.max(current, v));
    }
  }
  return out;
}

/**
 * restart_count is a cumulative counter per instance. Convert it into new restarts per
 * timestamp, summed across instances. A counter that goes down (instance replaced) adds 0;
 * the first point of each series has no baseline and also adds 0.
 */
function restartDeltas(series: readonly InstanceSeries[]): Map<number, number> {
  const out = new Map<number, number>();
  for (const s of series) {
    let previous: number | null = null;
    for (const [t, v] of s.points) {
      const delta = previous === null ? 0 : Math.max(0, Math.round(v - previous));
      out.set(t, (out.get(t) ?? 0) + delta);
      previous = v;
    }
  }
  return out;
}

const round2 = (v: number) => Math.round(v * 100) / 100;

export function mergeAppMetrics(input: {
  cpu: readonly InstanceSeries[];
  memory: readonly InstanceSeries[];
  restarts: readonly InstanceSeries[];
}): CollectedSample[] {
  const cpu = maxByTimestamp(input.cpu);
  const memory = maxByTimestamp(input.memory);
  const restarts = restartDeltas(input.restarts);
  const timestamps = [...new Set([...cpu.keys(), ...memory.keys(), ...restarts.keys()])].sort(
    (a, b) => a - b,
  );
  return timestamps.map((t) => {
    const c = cpu.get(t);
    const m = memory.get(t);
    const r = restarts.get(t);
    return {
      capturedAt: new Date(t * 1000),
      cpuPercent: c === undefined ? null : round2(c),
      memoryPercent: m === undefined ? null : round2(m),
      diskPercent: null,
      restartCount: r === undefined ? null : r,
    };
  });
}

// ─── Deployments ────────────────────────────────────────────────────────────

const deployedComponentSchema = z.object({
  name: z.string(),
  source_commit_hash: z.string().optional(),
});

const deploymentSchema = z.object({
  id: z.string(),
  phase: z.string().optional(),
  cause: z.string().optional(),
  created_at: z.string().refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date"),
  phase_last_updated_at: z.string().optional(),
  services: z.array(deployedComponentSchema).optional(),
  workers: z.array(deployedComponentSchema).optional(),
  static_sites: z.array(deployedComponentSchema).optional(),
  spec: z
    .object({
      services: z.array(doComponentSchema).optional(),
      workers: z.array(doComponentSchema).optional(),
      static_sites: z.array(doComponentSchema).optional(),
    })
    .optional(),
  progress: z
    .object({
      steps: z.array(z.object({ ended_at: z.string().optional() })).optional(),
    })
    .optional(),
  /** Undocumented; read defensively so a shape change never fails the whole response. */
  cause_details: z.unknown().optional(),
});

const deploymentListSchema = z.object({
  deployments: z.array(deploymentSchema).optional(),
  links: z.object({ pages: z.object({ next: z.string().optional() }).optional() }).optional(),
});

const gitPushSchema = z.object({
  git_push: z.object({
    commit_sha: z.string().optional(),
    commit_message: z.string().optional(),
  }),
});

export type DoDeployment = z.infer<typeof deploymentSchema>;

export function mapDoPhase(phase: string | undefined): CollectedDeployment["status"] {
  switch (phase) {
    case "ACTIVE":
    case "SUPERSEDED":
      return "SUCCESS";
    case "ERROR":
      return "FAILED";
    case "CANCELED":
      return "CANCELED";
    default:
      return "BUILDING";
  }
}

/** DO reports "0001-01-01T00:00:00Z" for unset times. */
function parseTime(value: string | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) || date.getUTCFullYear() < 2000 ? null : date;
}

function branchFromCause(cause: string | undefined): string | null {
  const match = cause?.match(/\/tree\/(\S+)/);
  return match?.[1] ?? null;
}

export function mapDoDeployment(
  deployment: DoDeployment,
  context: { appId: string; componentName: string | null },
): CollectedDeployment {
  const deployed = [
    ...(deployment.services ?? []),
    ...(deployment.workers ?? []),
    ...(deployment.static_sites ?? []),
  ];
  const component =
    deployed.find((c) => c.name === context.componentName) ??
    deployed.find((c) => c.source_commit_hash);

  const specComponents = [
    ...(deployment.spec?.services ?? []),
    ...(deployment.spec?.workers ?? []),
    ...(deployment.spec?.static_sites ?? []),
  ];
  const spec = specComponents.find((c) => c.name === (component?.name ?? context.componentName));
  const source = spec?.github ?? spec?.gitlab ?? spec?.bitbucket;

  const push = gitPushSchema.safeParse(deployment.cause_details);
  const status = mapDoPhase(deployment.phase);

  const stepEnds = (deployment.progress?.steps ?? [])
    .map((s) => parseTime(s.ended_at))
    .filter((d): d is Date => d !== null)
    .map((d) => d.getTime());
  const finishedAt =
    status === "BUILDING"
      ? null
      : stepEnds.length > 0
        ? new Date(Math.max(...stepEnds))
        : deployment.phase === "SUPERSEDED"
          ? null
          : parseTime(deployment.phase_last_updated_at);

  const startedAt = new Date(deployment.created_at);

  return {
    externalId: deployment.id,
    status,
    cause: deployment.cause?.trim() || null,
    commitSha:
      component?.source_commit_hash ||
      (push.success ? push.data.git_push.commit_sha : null) ||
      null,
    commitMessage: (push.success ? push.data.git_push.commit_message?.trim() : null) || null,
    branch: source?.branch ?? spec?.git?.branch ?? branchFromCause(deployment.cause),
    url: `https://cloud.digitalocean.com/apps/${context.appId}/deployments/${deployment.id}`,
    startedAt,
    finishedAt,
  };
}

// ─── Collector ──────────────────────────────────────────────────────────────

const APP_METRICS = {
  cpu: "cpu_percentage",
  memory: "memory_percentage",
  restarts: "restart_count",
} as const;

export function createDigitalOceanAppCollector(fetch: FetchFn): ResourceCollector {
  const metricSeries = async (
    token: string,
    resource: CollectorResource,
    metric: string,
    from: Date,
    to: Date,
  ) => {
    const params = new URLSearchParams({
      app_id: resource.externalId,
      start: String(Math.floor(from.getTime() / 1000)),
      end: String(Math.floor(to.getTime() / 1000)),
    });
    const component = doComponentName(resource.config);
    if (component) params.set("app_component", component);
    const matrix = await requestJson({
      fetch,
      provider: PROVIDER,
      url: `${DO_API_BASE}/v2/monitoring/metrics/apps/${metric}?${params}`,
      token,
      schema: matrixSchema,
    });
    return toInstanceSeries(matrix);
  };

  return {
    metrics: {
      async getMetrics({ token }, resource, from, to) {
        const [cpu, memory, restarts] = await Promise.all([
          metricSeries(token, resource, APP_METRICS.cpu, from, to),
          metricSeries(token, resource, APP_METRICS.memory, from, to),
          metricSeries(token, resource, APP_METRICS.restarts, from, to),
        ]);
        return mergeAppMetrics({ cpu, memory, restarts });
      },
    },

    deployments: {
      async listDeployments({ token }, resource, since) {
        const context = {
          appId: resource.externalId,
          componentName: doComponentName(resource.config),
        };
        const out: CollectedDeployment[] = [];
        for (let page = 1; page <= MAX_DEPLOYMENT_PAGES; page++) {
          const res = await requestJson({
            fetch,
            provider: PROVIDER,
            url: `${DO_API_BASE}/v2/apps/${encodeURIComponent(resource.externalId)}/deployments?page=${page}&per_page=${DEPLOYMENTS_PER_PAGE}`,
            token,
            schema: deploymentListSchema,
          });
          const mapped = (res.deployments ?? []).map((d) => mapDoDeployment(d, context));
          out.push(...mapped.filter((d) => d.startedAt >= since || d.status === "BUILDING"));
          const reachedOlder = mapped.some((d) => d.startedAt < since);
          if (reachedOlder || !res.links?.pages?.next || mapped.length === 0) break;
        }
        return out;
      },
    },
  };
}
