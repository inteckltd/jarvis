import "server-only";
import { Prisma, prisma, qualifiedTable } from "@jarvis/db";
import {
  bucketStart,
  type ChartRange,
  fillBuckets,
  intervalLiteral,
  METRIC_TYPES,
  RANGE_SPEC,
  type ResourceTypeName,
  uptimeFromBuckets,
} from "@jarvis/shared";
import { z } from "zod";
import type { DeploymentView } from "@/lib/dashboard";

export type MetricPoint = {
  t: number;
  cpu: number | null;
  cpuMax: number | null;
  memory: number | null;
  memoryMax: number | null;
  disk: number | null;
  connections: number | null;
  dbSize: number | null;
};

export type RestartPoint = { t: number; restarts: number };
export type HealthPoint = {
  t: number;
  up: number;
  total: number;
  /** % of checks up in this bucket; null = no checks. */
  uptime: number | null;
  avgMs: number | null;
};
export type FunctionPoint = { t: number; invocations: number; errors: number };

export type ResourceSeries = {
  metrics: MetricPoint[] | null;
  restarts: RestartPoint[] | null;
  health: HealthPoint[] | null;
  uptime: number | null;
  functions: FunctionPoint[] | null;
  deployments: DeploymentView[];
};

const num = z.number().nullable();

const metricRowSchema = z.object({
  resourceId: z.string(),
  t: z.number(),
  cpu: num,
  cpuMax: num,
  memory: num,
  memoryMax: num,
  disk: num,
  restarts: z.number(),
  connections: num,
  dbSize: num,
});

const healthRowSchema = z.object({
  resourceId: z.string(),
  t: z.number(),
  total: z.number(),
  up: z.number(),
  avgMs: num,
});

function round1(v: number | null): number | null {
  return v === null ? null : Math.round(v * 10) / 10;
}

async function metricRows(ids: string[], range: ChartRange, from: Date) {
  if (ids.length === 0) return [];
  const spec = RANGE_SPEC[range];
  const interval = intervalLiteral(spec.metricBucketMs);
  const idList = Prisma.join(ids);
  const rows =
    spec.metricSource === "snapshots"
      ? await prisma.$queryRaw`
          SELECT "resourceId",
            (extract(epoch FROM date_bin(${interval}::interval, "capturedAt", TIMESTAMP '1970-01-01')) * 1000)::float8 AS t,
            avg("cpuPercent")::float8 AS cpu,
            max("cpuPercent")::float8 AS "cpuMax",
            avg("memoryPercent")::float8 AS memory,
            max("memoryPercent")::float8 AS "memoryMax",
            avg("diskPercent")::float8 AS disk,
            coalesce(sum("restartCount"), 0)::float8 AS restarts,
            max("dbConnections")::float8 AS connections,
            max("dbSizeBytes")::float8 AS "dbSize"
          FROM ${Prisma.raw(qualifiedTable("MetricSnapshot"))}
          WHERE "resourceId" IN (${idList}) AND "capturedAt" >= ${from}
          GROUP BY 1, 2
          ORDER BY 2`
      : await prisma.$queryRaw`
          SELECT "resourceId",
            (extract(epoch FROM date_bin(${interval}::interval, "hour", TIMESTAMP '1970-01-01')) * 1000)::float8 AS t,
            avg("avgCpu")::float8 AS cpu,
            max("maxCpu")::float8 AS "cpuMax",
            avg("avgMemory")::float8 AS memory,
            max("maxMemory")::float8 AS "memoryMax",
            avg("avgDisk")::float8 AS disk,
            coalesce(sum("restarts"), 0)::float8 AS restarts,
            NULL::float8 AS connections,
            max("maxDbSizeBytes")::float8 AS "dbSize"
          FROM ${Prisma.raw(qualifiedTable("MetricRollupHourly"))}
          WHERE "resourceId" IN (${idList}) AND "hour" >= ${from}
          GROUP BY 1, 2
          ORDER BY 2`;
  return z.array(metricRowSchema).parse(rows);
}

async function healthRows(ids: string[], range: ChartRange, from: Date) {
  if (ids.length === 0) return [];
  const interval = intervalLiteral(RANGE_SPEC[range].healthBucketMs);
  const rows = await prisma.$queryRaw`
    SELECT "resourceId",
      (extract(epoch FROM date_bin(${interval}::interval, "checkedAt", TIMESTAMP '1970-01-01')) * 1000)::float8 AS t,
      count(*)::float8 AS total,
      (count(*) FILTER (WHERE "isUp"))::float8 AS up,
      (avg("responseMs") FILTER (WHERE "isUp"))::float8 AS "avgMs"
    FROM ${Prisma.raw(qualifiedTable("HealthCheck"))}
    WHERE "resourceId" IN (${Prisma.join(ids)}) AND "checkedAt" >= ${from}
    GROUP BY 1, 2
    ORDER BY 2`;
  return z.array(healthRowSchema).parse(rows);
}

function groupBy<T extends { resourceId: string }>(rows: readonly T[]): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const r of rows) {
    const list = out.get(r.resourceId) ?? [];
    list.push(r);
    out.set(r.resourceId, list);
  }
  return out;
}

export async function loadResourceSeries(
  resources: readonly {
    id: string;
    name: string;
    type: ResourceTypeName;
    environment: DeploymentView["environment"];
    hasHealthCheck: boolean;
  }[],
  range: ChartRange,
  now: Date = new Date(),
): Promise<Map<string, ResourceSeries>> {
  const spec = RANGE_SPEC[range];
  const fromMs = now.getTime() - spec.durationMs;
  const from = new Date(fromMs);
  const toMs = now.getTime();

  const metricIds = resources.filter((r) => METRIC_TYPES.includes(r.type)).map((r) => r.id);
  const healthIds = resources.filter((r) => r.hasHealthCheck).map((r) => r.id);
  const functionIds = resources.filter((r) => r.type === "SUPABASE_FUNCTIONS").map((r) => r.id);

  const [metrics, health, functions, deployments] = await Promise.all([
    metricRows(metricIds, range, from),
    healthRows(healthIds, range, from),
    functionIds.length
      ? prisma.functionStats.findMany({
          where: { resourceId: { in: functionIds }, periodEnd: { gt: from } },
          orderBy: { periodStart: "asc" },
          select: { resourceId: true, periodStart: true, invocations: true, errors: true },
        })
      : Promise.resolve([]),
    prisma.deployment.findMany({
      where: { resourceId: { in: resources.map((r) => r.id) }, startedAt: { gte: from } },
      orderBy: { startedAt: "desc" },
    }),
  ]);

  const metricsBy = groupBy(metrics);
  const healthBy = groupBy(health);
  const functionsBy = groupBy(functions);
  const deploymentsBy = groupBy(deployments);

  const out = new Map<string, ResourceSeries>();
  for (const r of resources) {
    const m = metricsBy.get(r.id);
    const restartBuckets = new Map<number, number>();
    for (const row of m ?? []) {
      const key = bucketStart(row.t, spec.restartBucketMs);
      restartBuckets.set(key, (restartBuckets.get(key) ?? 0) + row.restarts);
    }
    const h = healthBy.get(r.id);
    const healthPoints = h
      ? fillBuckets(
          h.map((row) => ({
            t: row.t,
            up: row.up,
            total: row.total,
            uptime: row.total ? Math.floor((row.up / row.total) * 10_000) / 100 : null,
            avgMs: row.avgMs === null ? null : Math.round(row.avgMs),
          })),
          fromMs,
          toMs,
          spec.healthBucketMs,
          (t) => ({ t, up: 0, total: 0, uptime: null, avgMs: null }),
        )
      : null;

    out.set(r.id, {
      metrics: METRIC_TYPES.includes(r.type)
        ? fillBuckets(
            (m ?? []).map((row) => ({
              t: row.t,
              cpu: round1(row.cpu),
              cpuMax: round1(row.cpuMax),
              memory: round1(row.memory),
              memoryMax: round1(row.memoryMax),
              disk: round1(row.disk),
              connections: row.connections,
              dbSize: row.dbSize,
            })),
            fromMs,
            toMs,
            spec.metricBucketMs,
            (t) => ({
              t,
              cpu: null,
              cpuMax: null,
              memory: null,
              memoryMax: null,
              disk: null,
              connections: null,
              dbSize: null,
            }),
          )
        : null,
      restarts:
        m && ["DO_APP", "DO_DROPLET", "AWS_EC2"].includes(r.type)
          ? fillBuckets(
              [...restartBuckets].map(([t, restarts]) => ({ t, restarts })),
              fromMs,
              toMs,
              spec.restartBucketMs,
              (t) => ({ t, restarts: 0 }),
            )
          : null,
      health: healthPoints,
      uptime: healthPoints ? uptimeFromBuckets(healthPoints) : null,
      functions:
        r.type === "SUPABASE_FUNCTIONS"
          ? (functionsBy.get(r.id) ?? []).map((f) => ({
              t: f.periodStart.getTime(),
              invocations: f.invocations,
              errors: f.errors,
            }))
          : null,
      deployments: (deploymentsBy.get(r.id) ?? []).map((d) => ({
        id: d.id,
        resourceName: r.name,
        environment: r.environment,
        status: d.status,
        commitMessage: d.commitMessage ?? d.cause,
        commitSha: d.commitSha,
        branch: d.branch,
        url: d.url,
        startedAt: d.startedAt,
        finishedAt: d.finishedAt,
      })),
    });
  }
  return out;
}
