import { listenPort, loadEnv } from "./env";
import { createSupabaseJwtVerifier } from "./lib/jwt";
import { buildServer } from "./server";

const env = loadEnv();

const app = await buildServer({
  verify: createSupabaseJwtVerifier({
    supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    allowedEmail: env.ALLOWED_EMAIL,
  }),
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

const shutdown = async (signal: string) => {
  app.log.info({ signal }, "shutting down");
  await app.close();
  process.exit(0);
};
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

await app.listen({ port: listenPort(env), host: env.HOST });
