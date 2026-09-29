/**
 * Creates the single Jarvis user (ALLOWED_EMAIL) in Supabase Auth with the email
 * already confirmed. Run once after creating the Supabase project, with public
 * sign-ups disabled. Safe to re-run.
 */
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const env = z
  .object({
    NEXT_PUBLIC_SUPABASE_URL: z.url(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
    ALLOWED_EMAIL: z.email().transform((v) => v.trim().toLowerCase()),
  })
  .parse(process.env);

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data, error } = await supabase.auth.admin.createUser({
  email: env.ALLOWED_EMAIL,
  email_confirm: true,
});

if (error) {
  if (error.code === "email_exists" || /already been registered/i.test(error.message)) {
    console.log(`User ${env.ALLOWED_EMAIL} already exists. Nothing to do.`);
  } else {
    console.error(`Failed to create user: ${error.message}`);
    process.exitCode = 1;
  }
} else {
  console.log(
    `Created user ${data.user.email} (${data.user.id}). Sign in with a magic link at /login.`,
  );
}
