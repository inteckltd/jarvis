import "server-only";
import { type z } from "zod";
import { getAccessToken } from "@/lib/auth";
import { serverEnv } from "@/lib/env";

export type ApiResult<T> =
  { ok: true; data: T } | { ok: false; status: number | null; error: string };

/** Server-side call to apps/api with the signed-in user's bearer token. */
export async function apiFetch<T>(
  path: string,
  schema: z.ZodType<T>,
  init: RequestInit = {},
): Promise<ApiResult<T>> {
  const token = await getAccessToken();
  if (!token) return { ok: false, status: 401, error: "Not signed in" };

  let res: Response;
  try {
    res = await fetch(new URL(path, serverEnv().API_URL), {
      ...init,
      cache: "no-store",
      headers: { ...init.headers, Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: init.signal ?? AbortSignal.timeout(5000),
    });
  } catch {
    return { ok: false, status: null, error: `API unreachable at ${serverEnv().API_URL}` };
  }

  if (!res.ok) return { ok: false, status: res.status, error: `API responded ${res.status}` };

  const parsed = schema.safeParse(await res.json());
  if (!parsed.success) return { ok: false, status: res.status, error: "Unexpected API response" };
  return { ok: true, data: parsed.data };
}
