import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  ALLOWED_EMAIL: z.email().transform((v) => v.trim().toLowerCase()),
  API_URL: z.url().default("http://localhost:4000"),
  /** 32 bytes, base64. Optional until an encrypted credential is stored; validated at startup. */
  ENCRYPTION_KEY: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : undefined)),
  /** Session-mode connection (Supabase port 5432) used by pg-boss; jobs are off without it. */
  DIRECT_URL: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : undefined)),
  /** Scheduled collection, rollups and retention. Set to "false" to run the API without them. */
  JOBS_ENABLED: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
  /** Set by hosting platforms such as DO App Platform; overrides the port in API_URL. */
  PORT: z.coerce.number().int().positive().optional(),
  HOST: z.string().default("0.0.0.0"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
});

export type ApiEnv = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): ApiEnv {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid apps/api environment:\n${issues}`);
  }
  return parsed.data;
}

export function listenPort(env: ApiEnv): number {
  if (env.PORT) return env.PORT;
  const port = new URL(env.API_URL).port;
  return port ? Number(port) : 4000;
}
