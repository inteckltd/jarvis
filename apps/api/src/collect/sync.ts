import { type PrismaClient, ResourceType } from "@jarvis/db";
import { RETENTION, type ResourceSyncResult, rollupHourly, startOfUtcHour } from "@jarvis/shared";
import { type FastifyBaseLogger } from "fastify";
import { type CollectorRegistry } from "../integrations";
import { type Credential, CredentialError, resolveCredential } from "../integrations/credentials";
import { ProviderError } from "../integrations/http";
import { type CollectorResource, type ResourceCollector } from "../integrations/types";
import { type SecretBox } from "../lib/crypto";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const COLLECTION_WINDOWS = {
  /** First metrics sync for a resource pulls this much history. */
  metricsBackfillMs: DAY,
  /** After downtime, never ask for more than this. */
  metricsMaxGapMs: 3 * DAY,
  /** Re-read a little before the newest stored sample so restart deltas have a baseline. */
  metricsOverlapMs: 10 * MINUTE,
  deploymentsBackfillMs: 30 * DAY,
  /** Re-read recent deployments so status changes (BUILDING → SUCCESS) are picked up. */
  deploymentsLookbackMs: DAY,
  rollupLookbackMs: 2 * HOUR,
} as const;

const CONCURRENCY = 4;

export type SyncDeps = {
  db: PrismaClient;
  env: NodeJS.ProcessEnv;
  box: SecretBox | null;
  collectors: CollectorRegistry;
  log: FastifyBaseLogger;
  now?: () => Date;
};

const resourceSelect = {
  id: true,
  name: true,
  type: true,
  externalId: true,
  config: true,
  lastError: true,
  providerAccount: {
    select: { provider: true, authType: true, envVarName: true, encryptedCredentials: true },
  },
} as const;

type SyncableResource = CollectorResource & {
  name: string;
  type: ResourceType;
  lastError: string | null;
  providerAccount: {
    provider: string;
    authType: string;
    envVarName: string | null;
    encryptedCredentials: string | null;
  };
};

export type SyncService = ReturnType<typeof createSyncService>;

/** Runs `fn` over `items` with at most `limit` in flight. */
async function mapPool<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index] as T);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export function createSyncService({
  db,
  env,
  box,
  collectors,
  log,
  now = () => new Date(),
}: SyncDeps) {
  /** Safe, user-facing text; anything unexpected is logged and replaced with a generic message. */
  function describe(error: unknown, resource: SyncableResource): string {
    if (error instanceof CredentialError || error instanceof ProviderError) return error.message;
    log.error({ err: error, resourceId: resource.id }, "unexpected collection error");
    return "Unexpected error while collecting data (see API logs)";
  }

  async function rollupResource(resourceId: string, from: Date, to: Date): Promise<number> {
    const samples = await db.metricSnapshot.findMany({
      where: { resourceId, capturedAt: { gte: startOfUtcHour(from), lte: to } },
      select: {
        capturedAt: true,
        cpuPercent: true,
        memoryPercent: true,
        diskPercent: true,
        restartCount: true,
        dbSizeBytes: true,
      },
      orderBy: { capturedAt: "asc" },
    });
    const hours = rollupHourly(samples);
    if (hours.length === 0) return 0;
    await db.$transaction(
      hours.map(({ hour, ...values }) =>
        db.metricRollupHourly.upsert({
          where: { resourceId_hour: { resourceId, hour } },
          create: { resourceId, hour, ...values },
          update: values,
        }),
      ),
    );
    return hours.length;
  }

  async function collectMetrics(
    collector: ResourceCollector,
    credential: Credential,
    resource: SyncableResource,
    at: Date,
  ): Promise<number> {
    if (!collector.metrics) return 0;
    const latest = await db.metricSnapshot.findFirst({
      where: { resourceId: resource.id },
      orderBy: { capturedAt: "desc" },
      select: { capturedAt: true },
    });
    const floor = at.getTime() - COLLECTION_WINDOWS.metricsMaxGapMs;
    const from = latest
      ? new Date(Math.max(latest.capturedAt.getTime() - COLLECTION_WINDOWS.metricsOverlapMs, floor))
      : new Date(at.getTime() - COLLECTION_WINDOWS.metricsBackfillMs);

    const samples = await collector.metrics.getMetrics(credential, resource, from, at);
    const fresh = latest ? samples.filter((s) => s.capturedAt > latest.capturedAt) : samples;
    const first = fresh[0];
    if (!first) return 0;

    const { count } = await db.metricSnapshot.createMany({
      data: fresh.map((s) => ({ resourceId: resource.id, ...s })),
      skipDuplicates: true,
    });
    await rollupResource(resource.id, first.capturedAt, at);
    return count;
  }

  async function collectDeployments(
    collector: ResourceCollector,
    credential: Credential,
    resource: SyncableResource,
    at: Date,
  ): Promise<number> {
    if (!collector.deployments) return 0;
    const [latest, oldestUnfinished] = await Promise.all([
      db.deployment.findFirst({
        where: { resourceId: resource.id },
        orderBy: { startedAt: "desc" },
        select: { startedAt: true },
      }),
      db.deployment.findFirst({
        where: { resourceId: resource.id, status: "BUILDING" },
        orderBy: { startedAt: "asc" },
        select: { startedAt: true },
      }),
    ]);
    const since = latest
      ? new Date(
          Math.min(
            latest.startedAt.getTime() - COLLECTION_WINDOWS.deploymentsLookbackMs,
            oldestUnfinished?.startedAt.getTime() ?? Infinity,
          ),
        )
      : new Date(at.getTime() - COLLECTION_WINDOWS.deploymentsBackfillMs);

    const deployments = await collector.deployments.listDeployments(credential, resource, since);
    if (deployments.length === 0) return 0;
    await db.$transaction(
      deployments.map(({ externalId, ...values }) =>
        db.deployment.upsert({
          where: { resourceId_externalId: { resourceId: resource.id, externalId } },
          create: { resourceId: resource.id, externalId, ...values },
          update: values,
        }),
      ),
    );
    return deployments.length;
  }

  /** Collects one resource. Never throws: failures are recorded on Resource.lastError. */
  async function syncResource(resource: SyncableResource): Promise<ResourceSyncResult> {
    const at = now();
    const collector = collectors[resource.type];
    let samples = 0;
    let deployments = 0;
    let error: string | null = null;

    if (!collector) {
      error = `Live collection for ${resource.type} is not available yet`;
    } else {
      try {
        const credential = resolveCredential(resource.providerAccount, { env, box });
        // Metrics and deployments are independent: one failing must not skip the other.
        const [metricsResult, deploymentsResult] = await Promise.allSettled([
          collectMetrics(collector, credential, resource, at),
          collectDeployments(collector, credential, resource, at),
        ]);
        if (metricsResult.status === "fulfilled") samples = metricsResult.value;
        else error = describe(metricsResult.reason, resource);
        if (deploymentsResult.status === "fulfilled") deployments = deploymentsResult.value;
        else error ??= describe(deploymentsResult.reason, resource);
      } catch (e) {
        error = describe(e, resource);
      }
    }

    if (error !== resource.lastError) {
      try {
        await db.resource.update({ where: { id: resource.id }, data: { lastError: error } });
      } catch (e) {
        log.error({ err: e, resourceId: resource.id }, "could not record lastError");
      }
    }
    if (error) log.warn({ resourceId: resource.id, reason: error }, "collection failed");
    else log.debug({ resourceId: resource.id, samples, deployments }, "collected");

    return {
      resourceId: resource.id,
      ok: error === null,
      samples,
      deployments,
      error,
      syncedAt: at.toISOString(),
    };
  }

  return {
    rollupResource,
    syncResource,

    /** null when the resource does not exist. */
    async syncById(id: string): Promise<ResourceSyncResult | null> {
      const resource = await db.resource.findUnique({ where: { id }, select: resourceSelect });
      return resource ? syncResource(resource) : null;
    },

    async syncAll(): Promise<ResourceSyncResult[]> {
      const resources = await db.resource.findMany({
        where: {
          active: true,
          type: { in: Object.values(ResourceType).filter((t) => collectors[t]) },
        },
        select: resourceSelect,
        orderBy: { createdAt: "asc" },
      });
      return mapPool(resources, CONCURRENCY, syncResource);
    },

    /** Safety net for the hourly rollup: recompute recent hours for anything with new samples. */
    async rollupRecent(): Promise<number> {
      const at = now();
      const from = new Date(at.getTime() - COLLECTION_WINDOWS.rollupLookbackMs);
      const recent = await db.metricSnapshot.groupBy({
        by: ["resourceId"],
        where: { capturedAt: { gte: from } },
      });
      const counts = await mapPool(recent, CONCURRENCY, (r) =>
        rollupResource(r.resourceId, from, at),
      );
      return counts.reduce((a, b) => a + b, 0);
    },

    async purge(): Promise<{ snapshots: number; healthChecks: number; rollups: number }> {
      const at = now();
      const rawCutoff = new Date(at.getTime() - RETENTION.rawDays * DAY);
      const rollupCutoff = new Date(at);
      rollupCutoff.setUTCMonth(rollupCutoff.getUTCMonth() - RETENTION.rollupMonths);
      const [snapshots, healthChecks, rollups] = await Promise.all([
        db.metricSnapshot.deleteMany({ where: { capturedAt: { lt: rawCutoff } } }),
        db.healthCheck.deleteMany({ where: { checkedAt: { lt: rawCutoff } } }),
        db.metricRollupHourly.deleteMany({ where: { hour: { lt: rollupCutoff } } }),
      ]);
      return {
        snapshots: snapshots.count,
        healthChecks: healthChecks.count,
        rollups: rollups.count,
      };
    },
  };
}
