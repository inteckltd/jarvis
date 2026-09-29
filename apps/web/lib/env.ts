import { z } from "zod";

/**
 * Public values are referenced literally so Next.js can inline them into client bundles.
 */
export const publicEnv = z
  .object({
    NEXT_PUBLIC_SUPABASE_URL: z.url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  })
  .parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });

const serverSchema = z.object({
  ALLOWED_EMAIL: z.email().transform((v) => v.trim().toLowerCase()),
  API_URL: z.url().default("http://localhost:4000"),
});

let cachedServerEnv: z.infer<typeof serverSchema> | undefined;

/** Server-only values. Never import the result into a client component. */
export function serverEnv(): z.infer<typeof serverSchema> {
  cachedServerEnv ??= serverSchema.parse({
    ALLOWED_EMAIL: process.env.ALLOWED_EMAIL,
    API_URL: process.env.API_URL,
  });
  return cachedServerEnv;
}
