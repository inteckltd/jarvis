import { type z } from "zod";

export type FetchFn = typeof fetch;

/** A provider call failed. `message` is safe to store as lastError and show in the UI. */
export class ProviderError extends Error {
  constructor(
    message: string,
    readonly status: number | null = null,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

const MAX_MESSAGE = 300;

function providerMessage(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  const candidates = [
    record.message,
    record.error_description,
    typeof record.error === "object" && record.error
      ? (record.error as Record<string, unknown>).message
      : record.error,
  ];
  const found = candidates.find((c): c is string => typeof c === "string" && c.trim() !== "");
  return found ? found.trim().slice(0, MAX_MESSAGE) : null;
}

type RequestOptions<T> = {
  fetch: FetchFn;
  provider: string;
  url: string | URL;
  token: string;
  schema: z.ZodType<T>;
  init?: RequestInit;
  timeoutMs?: number;
};

export async function requestJson<T>({
  fetch,
  provider,
  url,
  token,
  schema,
  init = {},
  timeoutMs = 15_000,
}: RequestOptions<T>): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: {
        Accept: "application/json",
        ...init.headers,
        Authorization: `Bearer ${token}`,
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    throw new ProviderError(
      timedOut
        ? `${provider} did not respond within ${timeoutMs / 1000}s`
        : `Could not reach ${provider}`,
    );
  }

  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }

  if (!res.ok) {
    const detail = providerMessage(body);
    const prefix =
      res.status === 401 || res.status === 403
        ? `${provider} rejected the token (${res.status})`
        : res.status === 429
          ? `${provider} rate limit reached (429)`
          : `${provider} responded ${res.status}`;
    throw new ProviderError(detail ? `${prefix}: ${detail}` : prefix, res.status);
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue?.path.length ? ` at ${issue.path.join(".")}` : "";
    throw new ProviderError(`Unexpected response from ${provider}${where}`, res.status);
  }
  return parsed.data;
}
