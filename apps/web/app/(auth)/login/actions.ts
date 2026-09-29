"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { isAllowedEmail, safeNextPath } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type LoginState =
  { status: "idle" } | { status: "sent"; email: string } | { status: "error"; message: string };

const formSchema = z.object({
  email: z.email("Enter a valid email address").transform((v) => v.trim().toLowerCase()),
  next: z.string().optional(),
});

async function requestOrigin(): Promise<string> {
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin;
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function sendMagicLink(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = formSchema.safeParse({
    email: formData.get("email"),
    next: formData.get("next") ?? undefined,
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid email" };
  }

  const { email } = parsed.data;

  // Same response for any address, so the form doesn't reveal which email is allowed.
  if (!isAllowedEmail(email)) return { status: "sent", email };

  const supabase = await createSupabaseServerClient();
  const callback = new URL("/auth/callback", await requestOrigin());
  callback.searchParams.set("next", safeNextPath(parsed.data.next));

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false, emailRedirectTo: callback.toString() },
  });

  if (error) {
    return { status: "error", message: error.message };
  }
  return { status: "sent", email };
}
