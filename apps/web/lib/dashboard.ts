import "server-only";
import { type DeploymentStatus, type MobileBuildStatus, prisma } from "@jarvis/db";
import {
  clientStatus,
  DEPLOY_TYPES,
  DAY_MS,
  type EnvironmentName,
  evaluateResource,
  HOUR_MS,
  type HealthStatus,
  londonDateOnlyBounds,
  METRIC_TYPES,
  type Reason,
  RESTART_THRESHOLDS,
  type ResourceEvaluation,
  type ResourceTypeName,
  startOfUtcHour,
  uptimePercent,
} from "@jarvis/shared";
import { TASK_LIST_SELECT } from "@/lib/tasks";

export type Spark = { cpu: number[]; memory: number[] };

export type DeploymentView = {
  id: string;
  resourceName: string;
  environment: EnvironmentName;
  status: DeploymentStatus;
  commitMessage: string | null;
  commitSha: string | null;
  branch: string | null;
  url: string | null;
  startedAt: Date;
  finishedAt: Date | null;
};

export type ResourceView = {
  id: string;
  name: string;
  type: ResourceTypeName;
  environment: EnvironmentName;
  liveUrl: string | null;
  evaluation: ResourceEvaluation;
  /** Latest reading, even if stale (see evaluation.metricsFresh). */
  metrics: {
    cpuPercent: number | null;
    memoryPercent: number | null;
    diskPercent: number | null;
    dbConnections: number | null;
    dbSizeBytes: number | null;
    capturedAt: Date;
  } | null;
  spark: Spark;
  restarts24h: number | null;
  uptime24h: number | null;
  uptime30d: number | null;
  responseMs: number | null;
  latestDeployment: DeploymentView | null;
  functions24h: { invocations: number; errors: number } | null;
};

export type MobileView = {
  resourceId: string;
  name: string;
  iosStoreVersion: { version: string; releasedAt: Date | null } | null;
  builds: {
    platform: "IOS" | "ANDROID";
    appVersion: string;
    buildNumber: string;
    status: MobileBuildStatus;
    profile: string;
    submittedToStore: boolean;
    createdAt: Date;
  }[];
};

export type ClientWarning = Reason & { resourceName: string; resourceId: string };

export type ClientBriefing = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  status: HealthStatus;
  production: ResourceView[];
  development: ResourceView[];
  developmentStatus: HealthStatus;
  mobile: MobileView[];
  recentDeployments: DeploymentView[];
  warnings: ClientWarning[];
  restarts24h: number;
  uptime24h: number | null;
};

export type Briefing = {
  now: Date;
  clients: ClientBriefing[];
  accountErrors: { id: string; label: string; message: string }[];
  /** Newest metric sample across all resources (null = none). */
  newestMetricAt: Date | null;
  tasks: {
    overdue: Awaited<ReturnType<typeof loadTasks>>["overdue"];
    today: Awaited<ReturnType<typeof loadTasks>>["today"];
  };
};

async function loadTasks(now: Date) {
  const { start, end } = londonDateOnlyBounds(now);
  const [overdue, today] = await Promise.all([
    prisma.task.findMany({
      where: { completed: false, dueDate: { lt: start } },
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
      select: TASK_LIST_SELECT,
    }),
    prisma.task.findMany({
      where: { completed: false, dueDate: { gte: start, lt: end } },
      orderBy: { createdAt: "asc" },
      select: TASK_LIST_SELECT,
    }),
  ]);
  return { overdue, today };
}

function countMap(
  rows: readonly { resourceId: string; isUp: boolean; _count: { _all: number } }[],
): Map<string, { up: number; total: number }> {
  const out = new Map<string, { up: number; total: number }>();
  for (const r of rows) {
    const cur = out.get(r.resourceId) ?? { up: 0, total: 0 };
    cur.total += r._count._all;
    if (r.isUp) cur.up += r._count._all;
    out.set(r.resourceId, cur);
  }
  return out;
}

const RECENT_DEPLOYS = 4;

export async function loadBriefing(
  now: Date = new Date(),
  options: { clientId?: string } = {},
): Promise<Briefing> {
  const clients = await prisma.client.findMany({
    where: options.clientId ? { id: options.clientId } : { active: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      logoUrl: true,
      resources: {
        where: { active: true },
        orderBy: [{ name: "asc" }, { type: "asc" }],
        select: {
          id: true,
          name: true,
          type: true,
          environment: true,
          liveUrl: true,
          healthCheckUrl: true,
          lastError: true,
        },
      },
    },
  });

  const resources = clients.flatMap((c) => c.resources);
  const metricIds = resources.filter((r) => METRIC_TYPES.includes(r.type)).map((r) => r.id);
  const healthIds = resources.filter((r) => r.healthCheckUrl).map((r) => r.id);
  const deployIds = resources.filter((r) => DEPLOY_TYPES.includes(r.type)).map((r) => r.id);
  const functionIds = resources.filter((r) => r.type === "SUPABASE_FUNCTIONS").map((r) => r.id);
  const mobileIds = resources.filter((r) => r.type === "EXPO_APP").map((r) => r.id);

  const since24h = new Date(now.getTime() - RESTART_THRESHOLDS.windowHours * HOUR_MS);
  const since30d = new Date(now.getTime() - 30 * DAY_MS);
  const sparkFrom = new Date(startOfUtcHour(now).getTime() - 23 * HOUR_MS);

  const [
    latestMetrics,
    restartSums,
    rollups,
    latestHealth,
    up24,
    up30,
    latestDeploys,
    recentDeploys,
    functionSums,
    storeVersions,
    mobileBuilds,
    accountErrors,
    tasks,
  ] = await Promise.all([
    Promise.all(
      metricIds.map((resourceId) =>
        prisma.metricSnapshot.findFirst({
          where: { resourceId },
          orderBy: { capturedAt: "desc" },
          select: {
            resourceId: true,
            cpuPercent: true,
            memoryPercent: true,
            diskPercent: true,
            dbConnections: true,
            dbSizeBytes: true,
            capturedAt: true,
          },
        }),
      ),
    ),
    prisma.metricSnapshot.groupBy({
      by: ["resourceId"],
      where: { resourceId: { in: metricIds }, capturedAt: { gte: since24h } },
      _sum: { restartCount: true },
      _count: { _all: true },
    }),
    prisma.metricRollupHourly.findMany({
      where: { resourceId: { in: metricIds }, hour: { gte: sparkFrom } },
      orderBy: { hour: "asc" },
      select: { resourceId: true, avgCpu: true, avgMemory: true },
    }),
    Promise.all(
      healthIds.map((resourceId) =>
        prisma.healthCheck.findFirst({
          where: { resourceId },
          orderBy: { checkedAt: "desc" },
          select: {
            resourceId: true,
            isUp: true,
            statusCode: true,
            responseMs: true,
            checkedAt: true,
          },
        }),
      ),
    ),
    prisma.healthCheck.groupBy({
      by: ["resourceId", "isUp"],
      where: { resourceId: { in: healthIds }, checkedAt: { gte: since24h } },
      _count: { _all: true },
    }),
    prisma.healthCheck.groupBy({
      by: ["resourceId", "isUp"],
      where: { resourceId: { in: healthIds }, checkedAt: { gte: since30d } },
      _count: { _all: true },
    }),
    Promise.all(
      deployIds.map((resourceId) =>
        prisma.deployment.findFirst({
          where: { resourceId },
          orderBy: { startedAt: "desc" },
        }),
      ),
    ),
    Promise.all(
      clients.map((c) =>
        prisma.deployment.findMany({
          where: {
            resource: { clientId: c.id, active: true, environment: "PRODUCTION" },
          },
          orderBy: { startedAt: "desc" },
          take: RECENT_DEPLOYS,
          include: { resource: { select: { name: true, environment: true } } },
        }),
      ),
    ),
    prisma.functionStats.groupBy({
      by: ["resourceId"],
      where: { resourceId: { in: functionIds }, periodEnd: { gt: since24h } },
      _sum: { invocations: true, errors: true },
    }),
    Promise.all(
      mobileIds.map((resourceId) =>
        prisma.storeVersion.findFirst({
          where: { resourceId, platform: "IOS" },
          orderBy: [{ releasedAt: { sort: "desc", nulls: "last" } }, { checkedAt: "desc" }],
          select: { resourceId: true, version: true, releasedAt: true },
        }),
      ),
    ),
    Promise.all(
      mobileIds.flatMap((resourceId) =>
        (["IOS", "ANDROID"] as const).map((platform) =>
          prisma.mobileBuild.findFirst({
            where: { resourceId, platform },
            orderBy: { createdAt: "desc" },
          }),
        ),
      ),
    ),
    prisma.providerAccount.findMany({
      where: { lastError: { not: null } },
      select: { id: true, label: true, lastError: true },
    }),
    loadTasks(now),
  ]);

  const metricsBy = new Map(latestMetrics.flatMap((m) => (m ? [[m.resourceId, m] as const] : [])));
  const restartsBy = new Map(
    restartSums.map((r) => [r.resourceId, r._count._all > 0 ? (r._sum.restartCount ?? 0) : null]),
  );
  const sparkBy = new Map<string, Spark>();
  for (const r of rollups) {
    const s = sparkBy.get(r.resourceId) ?? { cpu: [], memory: [] };
    if (r.avgCpu !== null) s.cpu.push(r.avgCpu);
    if (r.avgMemory !== null) s.memory.push(r.avgMemory);
    sparkBy.set(r.resourceId, s);
  }
  const healthBy = new Map(latestHealth.flatMap((h) => (h ? [[h.resourceId, h] as const] : [])));
  const up24By = countMap(up24);
  const up30By = countMap(up30);
  const deployBy = new Map(latestDeploys.flatMap((d) => (d ? [[d.resourceId, d] as const] : [])));
  const functionsBy = new Map(
    functionSums.map((f) => [
      f.resourceId,
      { invocations: f._sum.invocations ?? 0, errors: f._sum.errors ?? 0 },
    ]),
  );
  const storeBy = new Map(storeVersions.flatMap((v) => (v ? [[v.resourceId, v] as const] : [])));
  const buildsBy = new Map<string, MobileView["builds"]>();
  for (const b of mobileBuilds) {
    if (!b) continue;
    const list = buildsBy.get(b.resourceId) ?? [];
    list.push({
      platform: b.platform,
      appVersion: b.appVersion,
      buildNumber: b.buildNumber,
      status: b.status,
      profile: b.profile,
      submittedToStore: b.submittedToStore,
      createdAt: b.createdAt,
    });
    buildsBy.set(b.resourceId, list);
  }

  const toDeployView = (
    d: NonNullable<(typeof latestDeploys)[number]>,
    resourceName: string,
    environment: EnvironmentName,
  ): DeploymentView => ({
    id: d.id,
    resourceName,
    environment,
    status: d.status,
    commitMessage: d.commitMessage ?? d.cause,
    commitSha: d.commitSha,
    branch: d.branch,
    url: d.url,
    startedAt: d.startedAt,
    finishedAt: d.finishedAt,
  });

  const briefings: ClientBriefing[] = clients.map((client, index) => {
    const views: ResourceView[] = client.resources
      .filter((r) => r.type !== "EXPO_APP")
      .map((r) => {
        const m = metricsBy.get(r.id) ?? null;
        const h = healthBy.get(r.id) ?? null;
        const d = deployBy.get(r.id) ?? null;
        const restarts = restartsBy.get(r.id) ?? null;
        const u24 = up24By.get(r.id);
        const u30 = up30By.get(r.id);
        const evaluation = evaluateResource({
          type: r.type,
          environment: r.environment,
          metrics: m,
          restarts,
          latestDeployment: d,
          hasHealthCheck: Boolean(r.healthCheckUrl),
          latestHealth: h,
          functions: functionsBy.get(r.id) ?? null,
          lastError: r.lastError,
          now,
        });
        return {
          id: r.id,
          name: r.name,
          type: r.type,
          environment: r.environment,
          liveUrl: r.liveUrl,
          evaluation,
          metrics: m && {
            cpuPercent: m.cpuPercent,
            memoryPercent: m.memoryPercent,
            diskPercent: m.diskPercent,
            dbConnections: m.dbConnections,
            dbSizeBytes: m.dbSizeBytes === null ? null : Number(m.dbSizeBytes),
            capturedAt: m.capturedAt,
          },
          spark: sparkBy.get(r.id) ?? { cpu: [], memory: [] },
          restarts24h: restarts,
          uptime24h: u24 ? uptimePercent(u24.up, u24.total) : null,
          uptime30d: u30 ? uptimePercent(u30.up, u30.total) : null,
          responseMs: h?.responseMs ?? null,
          latestDeployment: d && toDeployView(d, r.name, r.environment),
          functions24h: functionsBy.get(r.id) ?? null,
        };
      });

    const production = views.filter((v) => v.environment === "PRODUCTION");
    const development = views.filter((v) => v.environment === "DEVELOPMENT");
    const status = clientStatus(
      views.map((v) => ({ environment: v.environment, status: v.evaluation.status })),
    );

    const prodUp = production.reduce(
      (acc, v) => {
        const u = up24By.get(v.id);
        return u ? { up: acc.up + u.up, total: acc.total + u.total } : acc;
      },
      { up: 0, total: 0 },
    );

    return {
      id: client.id,
      name: client.name,
      slug: client.slug,
      logoUrl: client.logoUrl,
      status,
      production,
      development,
      developmentStatus: clientStatus(
        development.map((v) => ({ environment: "PRODUCTION", status: v.evaluation.status })),
      ),
      mobile: client.resources
        .filter((r) => r.type === "EXPO_APP")
        .map((r) => ({
          resourceId: r.id,
          name: r.name,
          iosStoreVersion: storeBy.get(r.id) ?? null,
          builds: buildsBy.get(r.id) ?? [],
        })),
      recentDeployments: (recentDeploys[index] ?? []).map((d) =>
        toDeployView(d, d.resource.name, d.resource.environment),
      ),
      warnings: production.flatMap((v) =>
        v.evaluation.reasons.map((reason) => ({
          ...reason,
          resourceName: v.name,
          resourceId: v.id,
        })),
      ),
      restarts24h: production.reduce((sum, v) => sum + (v.restarts24h ?? 0), 0),
      uptime24h: uptimePercent(prodUp.up, prodUp.total),
    };
  });

  const newestMetricAt = latestMetrics.reduce<Date | null>(
    (max, m) => (m && (!max || m.capturedAt > max) ? m.capturedAt : max),
    null,
  );

  return {
    now,
    clients: briefings,
    accountErrors: accountErrors.map((a) => ({
      id: a.id,
      label: a.label,
      message: a.lastError ?? "",
    })),
    newestMetricAt,
    tasks,
  };
}
