import { listenPort, loadEnv } from "./env";
import { type Jobs, startJobs } from "./jobs";
import { createSecretBox, parseEncryptionKey } from "./lib/crypto";
import { createSupabaseJwtVerifier } from "./lib/jwt";
import { buildServer } from "./server";

const env = loadEnv();

const app = await buildServer({
  verify: createSupabaseJwtVerifier({
    supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    allowedEmail: env.ALLOWED_EMAIL,
  }),
  integrations: {
    box: env.ENCRYPTION_KEY ? createSecretBox(parseEncryptionKey(env.ENCRYPTION_KEY)) : null,
  },
  logger: {
    level: env.LOG_LEVEL,
    redact: ["req.headers.authorization", "req.headers.cookie"],
    ...(env.NODE_ENV === "development"
      ? {
          transport: {
            target: "pino-pretty",
            options: { translateTime: "SYS:HH:MM:ss", ignore: "pid,hostname" },
          },
        }
      : {}),
  },
});

if (!env.ENCRYPTION_KEY) {
  app.log.warn("ENCRYPTION_KEY is not set: provider accounts can only use env-var tokens");
}

let jobs: Jobs | null = null;

const shutdown = async (signal: string) => {
  app.log.info({ signal }, "shutting down");
  await jobs?.stop().catch((err: unknown) => app.log.error({ err }, "stopping jobs failed"));
  await app.close();
  process.exit(0);
};
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

await app.listen({ port: listenPort(env), host: env.HOST });

if (!env.JOBS_ENABLED) {
  app.log.info("JOBS_ENABLED=false: scheduled collection is off");
} else if (!env.DIRECT_URL) {
  app.log.warn("DIRECT_URL is not set: scheduled collection is off");
} else {
  try {
    jobs = await startJobs({ databaseUrl: env.DIRECT_URL, sync: app.sync, log: app.log });
  } catch (err) {
    // The API still serves requests (and "Sync now") without the scheduler.
    app.log.error({ err }, "could not start scheduled jobs");
  }
}
