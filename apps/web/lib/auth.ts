import "server-only";
import { redirect } from "next/navigation";
import { serverEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SessionUser = { sub: string; email: string };

export function isAllowedEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === serverEnv().ALLOWED_EMAIL;
}

/** Returns the verified user from the session JWT, or null. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims || typeof claims.email !== "string" || !isAllowedEmail(claims.email)) return null;
  return { sub: claims.sub, email: claims.email };
}

/** Second line of defence behind the middleware for every authenticated page. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

/** Access token for calling apps/api on the user's behalf. apps/api verifies it independently. */
export async function getAccessToken(): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

/** Only allow relative, same-origin redirect targets. */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  return next;
}
