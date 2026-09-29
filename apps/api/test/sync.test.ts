import { type PrismaClient } from "@jarvis/db";
import { type FastifyBaseLogger } from "fastify";
import { beforeEach, describe, expect, it } from "vitest";
import { COLLECTION_WINDOWS, createSyncService } from "../src/collect/sync";
import { type CollectorRegistry } from "../src/integrations";
import { ProviderError } from "../src/integrations/http";
import {
  type CollectedDeployment,
  type CollectedSample,
  type CollectorResource,
} from "../src/integrations/types";
import { pgBossConnection } from "../src/jobs";

const NOW = new Date("2026-09-29T12:00:00Z");
const MIN = 60_000;

type Row = {
  id: string;
  name: string;
  type: string;
  externalId: string;
  config: unknown;
  lastError: string | null;
  active: boolean;
  providerAccount: {
    provider: string;
    authType: string;
    envVarName: string | null;
    encryptedCredentials: string | null;
  };
};
type Snapshot = CollectedSample & { resourceId: string; dbSizeBytes: bigint | null };
type Deployment = CollectedDeployment & { resourceId: string };

let resources: Row[];
let snapshots: Snapshot[];
let deployments: Deployment[];
let rollups: Array<{ resourceId: string; hour: Date; restarts: number; maxCpu: number | null }>;

const account = {
  provider: "DIGITALOCEAN",
  authType: "ENV_TOKEN",
  envVarName: "DO_API_TOKEN",
  encryptedCredentials: null,
};
const row = (id: string, over: Partial<Row> = {}): Row => ({
  id,
  name: id,
  type: "DO_APP",
  externalId: `app-${id}`,
  config: { componentName: "api" },
  lastError: null,
  active: true,
  providerAccount: account,
  ...over,
});

type Where = { resourceId?: string; capturedAt?: { gte?: Date; lte?: Date }; status?: string };
const matches = (s: { resourceId: string; capturedAt?: Date; status?: string }, where: Where) =>
  (!where.resourceId || s.resourceId === where.resourceId) &&
  (!where.status || s.status === where.status) &&
  (!where.capturedAt?.gte || (s.capturedAt ?? NOW) >= where.capturedAt.gte) &&
  (!where.capturedAt?.lte || (s.capturedAt ?? NOW) <= where.capturedAt.lte);

// Minimal in-memory stand-in for the Prisma calls the sync service makes.
const db = {
  $transaction: async (ops: Array<Promise<unknown>>) => Promise.all(ops),
  resource: {
    findMany: async ({ where }: { where: { type: { in: string[] } } }) =>
      resources.filter((r) => r.active && where.type.in.includes(r.type)),
    findUnique: async ({ where }: { where: { id: string } }) =>
      resources.find((r) => r.id === where.id) ?? null,
    update: async ({ where, data }: { where: { id: string }; data: Partial<Row> }) => {
      const r = resources.find((x) => x.id === where.id);
      if (r) Object.assign(r, data);
      return r;
    },
  },
  metricSnapshot: {
    findFirst: async ({ where }: { where: Where }) =>
      snapshots
        .filter((s) => matches(s, where))
        .sort((a, b) => b.capturedAt.getTime() - a.capturedAt.getTime())[0] ?? null,
    findMany: async ({ where }: { where: Where }) =>
      snapshots
        .filter((s) => matches(s, where))
        .sort((a, b) => a.capturedAt.getTime() - b.capturedAt.getTime()),
    createMany: async ({ data }: { data: Array<Omit<Snapshot, "dbSizeBytes">> }) => {
      snapshots.push(...data.map((d) => ({ ...d, dbSizeBytes: null })));
      return { count: data.length };
    },
  },
  metricRollupHourly: {
    upsert: async ({
      create,
    }: {
      create: { resourceId: string; hour: Date; restarts: number; maxCpu: number | null };
    }) => {
      rollups = rollups.filter(
        (r) => !(r.resourceId === create.resourceId && r.hour.getTime() === create.hour.getTime()),
      );
      rollups.push(create);
    },
  },
  deployment: {
    findFirst: async ({ where, orderBy }: { where: Where; orderBy: { startedAt: string } }) =>
      deployments
        .filter((d) => matches(d, where))
        .sort((a, b) =>
          orderBy.startedAt === "asc"
            ? a.startedAt.getTime() - b.startedAt.getTime()
            : b.startedAt.getTime() - a.startedAt.getTime(),
        )[0] ?? null,
    upsert: async ({
      where,
      create,
      update,
    }: {
      where: { resourceId_externalId: { resourceId: string; externalId: string } };
      create: Deployment;
      update: Partial<Deployment>;
    }) => {
      const key = where.resourceId_externalId;
      const existing = deployments.find(
        (d) => d.resourceId === key.resourceId && d.externalId === key.externalId,
      );
      if (existing) Object.assign(existing, update);
      else deployments.push(create);
    },
  },
} as unknown as PrismaClient;

const silent = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  debug: () => undefined,
} as unknown as FastifyBaseLogger;

const sample = (at: Date, cpu: number, restarts = 0): CollectedSample => ({
  capturedAt: at,
  cpuPercent: cpu,
  memoryPercent: 40,
  diskPercent: null,
  restartCount: restarts,
});

type MetricsCall = { resource: CollectorResource; from: Date; to: Date };

function collectors(
  opts: {
    metrics?: (call: MetricsCall) => CollectedSample[];
    deploymentsSince?: Date[];
    deployments?: CollectedDeployment[];
    fail?: string;
  } = {},
) {
  const metricsCalls: MetricsCall[] = [];
  const registry: CollectorRegistry = {
    DO_APP: {
      metrics: {
        async getMetrics(_credential, resource, from, to) {
          metricsCalls.push({ resource, from, to });
          if (opts.fail === resource.id) throw new ProviderError("DigitalOcean responded 404");
          return opts.metrics?.({ resource, from, to }) ?? [];
        },
      },
      deployments: {
        async listDeployments(_credential, _resource, since) {
          opts.deploymentsSince?.push(since);
          return opts.deployments ?? [];
        },
      },
    },
  };
  return { registry, metricsCalls };
}

const service = (registry: CollectorRegistry, env: NodeJS.ProcessEnv = { DO_API_TOKEN: "t" }) =>
  createSyncService({ db, env, box: null, collectors: registry, log: silent, now: () => NOW });

beforeEach(() => {
  resources = [];
  snapshots = [];
  deployments = [];
  rollups = [];
});

describe("sync service", () => {
  it("backfills 24h on first sync, stores samples and rolls them up", async () => {
    resources.push(row("a"));
    const { registry, metricsCalls } = collectors({
      metrics: () => [
        sample(new Date("2026-09-29T10:58:00Z"), 20),
        sample(new Date("2026-09-29T11:00:00Z"), 30, 1),
        sample(new Date("2026-09-29T11:02:00Z"), 50),
      ],
    });
    const [result] = await service(registry).syncAll();

    expect(metricsCalls[0]?.from).toEqual(
      new Date(NOW.getTime() - COLLECTION_WINDOWS.metricsBackfillMs),
    );
    expect(result).toMatchObject({ resourceId: "a", ok: true, samples: 3, error: null });
    expect(rollups.map((r) => [r.hour.toISOString(), r.maxCpu, r.restarts])).toEqual([
      ["2026-09-29T10:00:00.000Z", 20, 0],
      ["2026-09-29T11:00:00.000Z", 50, 1],
    ]);
  });

  it("re-reads a small overlap but only stores samples newer than the latest", async () => {
    resources.push(row("a"));
    const latest = new Date(NOW.getTime() - 5 * MIN);
    snapshots.push({ ...sample(latest, 10), resourceId: "a", dbSizeBytes: null });
    const { registry, metricsCalls } = collectors({
      metrics: () => [
        sample(new Date(latest.getTime() - MIN), 11),
        sample(latest, 10),
        sample(NOW, 12),
      ],
    });
    const [result] = await service(registry).syncAll();

    expect(metricsCalls[0]?.from).toEqual(
      new Date(latest.getTime() - COLLECTION_WINDOWS.metricsOverlapMs),
    );
    expect(result?.samples).toBe(1);
    expect(snapshots).toHaveLength(2);
  });

  it("isolates failures: records lastError on one resource, others still collect", async () => {
    resources.push(row("bad"), row("good", { lastError: "old problem" }));
    const { registry } = collectors({ fail: "bad", metrics: () => [sample(NOW, 5)] });
    const results = await service(registry).syncAll();

    expect(results.map((r) => [r.resourceId, r.ok, r.error])).toEqual([
      ["bad", false, "DigitalOcean responded 404"],
      ["good", true, null],
    ]);
    expect(resources.find((r) => r.id === "bad")?.lastError).toBe("DigitalOcean responded 404");
    expect(resources.find((r) => r.id === "good")?.lastError).toBeNull();
  });

  it("reports a missing token as the resource error", async () => {
    resources.push(row("a"));
    const { registry, metricsCalls } = collectors();
    const [result] = await service(registry, {}).syncAll();
    expect(result?.error).toBe("DO_API_TOKEN is not set in the API environment");
    expect(metricsCalls).toHaveLength(0);
  });

  it("upserts deployments and looks back far enough to settle in-progress ones", async () => {
    resources.push(row("a"));
    deployments.push(
      {
        resourceId: "a",
        externalId: "old-building",
        status: "BUILDING",
        cause: null,
        commitSha: null,
        commitMessage: null,
        branch: null,
        url: null,
        startedAt: new Date("2026-09-20T00:00:00Z"),
        finishedAt: null,
      },
      {
        resourceId: "a",
        externalId: "recent",
        status: "SUCCESS",
        cause: null,
        commitSha: null,
        commitMessage: null,
        branch: null,
        url: null,
        startedAt: new Date("2026-09-28T00:00:00Z"),
        finishedAt: null,
      },
    );
    const since: Date[] = [];
    const { registry } = collectors({
      deploymentsSince: since,
      deployments: [
        {
          externalId: "old-building",
          status: "FAILED",
          cause: "commit abc",
          commitSha: "abc",
          commitMessage: null,
          branch: "main",
          url: null,
          startedAt: new Date("2026-09-20T00:00:00Z"),
          finishedAt: new Date("2026-09-20T00:05:00Z"),
        },
      ],
    });
    const [result] = await service(registry).syncAll();

    expect(since[0]).toEqual(new Date("2026-09-20T00:00:00Z"));
    expect(result?.deployments).toBe(1);
    expect(deployments.find((d) => d.externalId === "old-building")?.status).toBe("FAILED");
  });

  it("returns null for unknown resources and an error for types without a collector", async () => {
    resources.push(row("vercel", { type: "VERCEL_PROJECT" }));
    const { registry } = collectors();
    const sync = service(registry);
    expect(await sync.syncById("missing")).toBeNull();
    expect((await sync.syncById("vercel"))?.error).toMatch(/not available yet/);
    expect(await sync.syncAll()).toEqual([]);
  });
});

describe("pgBossConnection", () => {
  it("strips Prisma params and enables TLS for remote hosts", () => {
    const { connectionString, ssl } = pgBossConnection(
      "postgresql://u:p@aws-0-eu-west-2.pooler.supabase.com:5432/postgres?schema=jarvis&pgbouncer=true&sslmode=require",
    );
    expect(connectionString).toBe(
      "postgresql://u:p@aws-0-eu-west-2.pooler.supabase.com:5432/postgres",
    );
    expect(ssl).toEqual({ rejectUnauthorized: false });
  });

  it("uses plain connections for localhost", () => {
    expect(pgBossConnection("postgresql://u:p@localhost:5432/jarvis").ssl).toBe(false);
  });
});
