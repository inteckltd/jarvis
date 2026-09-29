import "server-only";
import { type z } from "zod";
import { getAccessToken } from "@/lib/auth";
import { serverEnv } from "@/lib/env";

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number | null; error: string; fieldErrors: Record<string, string> };

type ApiOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  /** Serialised as JSON. */
  body?: unknown;
  timeoutMs?: number;
};

function errorDetails(body: unknown): {
  message: string | null;
  fieldErrors: Record<string, string>;
} {
  if (!body || typeof body !== "object") return { message: null, fieldErrors: {} };
  const record = body as Record<string, unknown>;
  const fieldErrors: Record<string, string> = {};
  if (record.fieldErrors && typeof record.fieldErrors === "object") {
    for (const [k, v] of Object.entries(record.fieldErrors)) {
      if (typeof v === "string") fieldErrors[k] = v;
    }
  }
  return { message: typeof record.message === "string" ? record.message : null, fieldErrors };
}

/** Server-side call to apps/api with the signed-in user's bearer token. */
export async function apiFetch<T>(
  path: string,
  schema: z.ZodType<T>,
  { method = "GET", body, timeoutMs = 5000 }: ApiOptions = {},
): Promise<ApiResult<T>> {
  const token = await getAccessToken();
  if (!token) return { ok: false, status: 401, error: "Not signed in", fieldErrors: {} };

  let res: Response;
  try {
    res = await fetch(new URL(path, serverEnv().API_URL), {
      method,
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    return {
      ok: false,
      status: null,
      error: timedOut
        ? "The API took too long to respond"
        : `API unreachable at ${serverEnv().API_URL}`,
      fieldErrors: {},
    };
  }

  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!res.ok) {
    const { message, fieldErrors } = errorDetails(json);
    return {
      ok: false,
      status: res.status,
      error: message ?? `API responded ${res.status}`,
      fieldErrors,
    };
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return { ok: false, status: res.status, error: "Unexpected API response", fieldErrors: {} };
  }
  return { ok: true, data: parsed.data };
}
