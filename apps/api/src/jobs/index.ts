import { COLLECTION_SCHEDULE } from "@jarvis/shared";
import { type FastifyBaseLogger } from "fastify";
import { PgBoss } from "pg-boss";
import { type SyncService } from "../collect/sync";

const QUEUES = {
  collect: "collect-resources",
  rollup: "rollup-hourly",
  retention: "purge-retention",
} as const;

type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

/**
 * pg-boss needs a session connection (advisory locks), so it uses DIRECT_URL, never the
 * transaction pooler. Prisma-only query params are removed; TLS is configured explicitly.
 */
export function pgBossConnection(url: string): { connectionString: string; ssl: false | object } {
  const parsed = new URL(url);
  for (const param of ["schema", "pgbouncer", "connection_limit", "sslmode", "sslaccept"]) {
    parsed.searchParams.delete(param);
  }
  const local = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(parsed.hostname);
  // Supabase's pooler certificate is issued by Supabase's own CA, which Node does not trust;
  // this matches Prisma's default (encrypted, not verified).
  return {
    connectionString: parsed.toString(),
    ssl: local ? false : { rejectUnauthorized: false },
  };
}

export type Jobs = { stop(): Promise<void> };

export async function startJobs({
  databaseUrl,
  sync,
  log,
}: {
  databaseUrl: string;
  sync: SyncService;
  log: FastifyBaseLogger;
}): Promise<Jobs> {
  const { connectionString, ssl } = pgBossConnection(databaseUrl);
  const boss = new PgBoss({
    connectionString,
    ssl,
    schema: "pgboss",
    application_name: "jarvis-api",
    max: 4,
  });
  boss.on("error", (err) => log.error({ err }, "pg-boss error"));
  await boss.start();

  const ensureQueue = async (name: QueueName, expireInSeconds: number) => {
    if (await boss.getQueue(name)) return;
    // "stately": at most one queued and one active, so slow runs never pile up.
    await boss.createQueue(name, {
      policy: "stately",
      retryLimit: 0,
      expireInSeconds,
      deleteAfterSeconds: 24 * 60 * 60,
    });
  };

  const register = async (
    name: QueueName,
    cron: string,
    expireInSeconds: number,
    run: () => Promise<Record<string, unknown>>,
  ) => {
    await ensureQueue(name, expireInSeconds);
    await boss.schedule(name, cron, null, { tz: "UTC" });
    await boss.work(name, async () => {
      const started = Date.now();
      try {
        const summary = await run();
        log.info({ job: name, ms: Date.now() - started, ...summary }, "job finished");
        return summary;
      } catch (err) {
        log.error({ err, job: name }, "job failed");
        throw err;
      }
    });
  };

  // A run takes seconds; a short expiry frees the queue quickly if the process dies mid-run.
  await register(QUEUES.collect, COLLECTION_SCHEDULE.collectCron, 2 * 60, async () => {
    const results = await sync.syncAll();
    return {
      resources: results.length,
      failed: results.filter((r) => !r.ok).length,
      samples: results.reduce((n, r) => n + r.samples, 0),
      deployments: results.reduce((n, r) => n + r.deployments, 0),
    };
  });
  await register(QUEUES.rollup, COLLECTION_SCHEDULE.rollupCron, 10 * 60, async () => ({
    hours: await sync.rollupRecent(),
  }));
  await register(QUEUES.retention, COLLECTION_SCHEDULE.retentionCron, 30 * 60, () => sync.purge());

  // Collect straight away rather than waiting for the next 5-minute boundary.
  await boss.send(QUEUES.collect);
  log.info("scheduled jobs started");

  return {
    async stop() {
      await boss.stop({ graceful: true, timeout: 10_000 });
    },
  };
}
