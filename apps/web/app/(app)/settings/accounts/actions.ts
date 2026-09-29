"use server";

import {
  connectionTestResultSchema,
  type ConnectionTestResult,
  type DiscoveredResource,
  discoveryResultSchema,
  firstFieldErrors,
  providerAccountSchema,
} from "@jarvis/shared";
import { prisma } from "@jarvis/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { apiFetch } from "@/lib/api";
import { requireUser } from "@/lib/auth";

export type AccountFormState =
  | { status: "idle" }
  | { status: "error"; message: string | null; fieldErrors: Record<string, string> };

function readAccountForm(formData: FormData) {
  const text = (key: string) => {
    const v = formData.get(key);
    return typeof v === "string" ? v : "";
  };
  return {
    provider: text("provider"),
    label: text("label"),
    clientId: text("clientId"),
    authType: text("authType"),
    envVarName: text("envVarName"),
    token: text("token"),
    teamId: text("teamId"),
  };
}

const idSchema = z.object({ id: z.string() });

async function submitAccount(
  accountId: string | null,
  formData: FormData,
  options: { clientId?: string; redirectTo?: (id: string) => string } = {},
): Promise<AccountFormState> {
  await requireUser();

  const raw = {
    ...readAccountForm(formData),
    ...(options.clientId ? { clientId: options.clientId } : {}),
  };
  const parsed = providerAccountSchema({ requireToken: accountId === null }).safeParse(raw);
  if (!parsed.success) {
    return { status: "error", message: null, fieldErrors: firstFieldErrors(parsed.error) };
  }

  // The raw form goes to the API, which validates again and is the only place tokens are handled.
  const res = await apiFetch(
    accountId ? `/v1/provider-accounts/${encodeURIComponent(accountId)}` : "/v1/provider-accounts",
    idSchema,
    { method: accountId ? "PATCH" : "POST", body: raw },
  );
  if (!res.ok) return { status: "error", message: res.error, fieldErrors: res.fieldErrors };

  revalidatePath("/settings", "layout");
  revalidatePath("/clients", "layout");
  redirect(
    options.redirectTo ? options.redirectTo(res.data.id) : `/settings/accounts/${res.data.id}`,
  );
}

/** Connects a client-owned account from the client's page and returns there to import. */
export async function createClientAccountAction(
  clientSlug: string,
  _prev: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const client = await prisma.client.findUnique({
    where: { slug: clientSlug },
    select: { id: true },
  });
  if (!client)
    return { status: "error", message: "This client no longer exists.", fieldErrors: {} };
  return submitAccount(null, formData, {
    clientId: client.id,
    redirectTo: (id) => `/clients/${clientSlug}/resources/import?account=${encodeURIComponent(id)}`,
  });
}

export async function createAccountAction(
  _prev: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  return submitAccount(null, formData);
}

export async function updateAccountAction(
  accountId: string,
  _prev: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  return submitAccount(accountId, formData);
}

export async function deleteAccountAction(
  accountId: string,
): Promise<{ error: string } | undefined> {
  await requireUser();
  const res = await apiFetch(
    `/v1/provider-accounts/${encodeURIComponent(accountId)}`,
    z.unknown(),
    {
      method: "DELETE",
    },
  );
  if (!res.ok) return { error: res.error };
  revalidatePath("/settings", "layout");
  redirect("/settings/accounts");
}

export async function testConnectionAction(accountId: string): Promise<ConnectionTestResult> {
  await requireUser();
  const res = await apiFetch(
    `/v1/provider-accounts/${encodeURIComponent(accountId)}/test`,
    connectionTestResultSchema,
    { method: "POST", timeoutMs: 20_000 },
  );
  revalidatePath(`/settings/accounts/${accountId}`);
  revalidatePath("/settings/accounts");
  return res.ok ? res.data : { ok: false, message: res.error, verifiedAt: null };
}

export type DiscoveryResponse =
  { ok: true; items: DiscoveredResource[] } | { ok: false; message: string };

export async function discoverAction(accountId: string): Promise<DiscoveryResponse> {
  await requireUser();
  const res = await apiFetch(
    `/v1/provider-accounts/${encodeURIComponent(accountId)}/discover`,
    discoveryResultSchema,
    { timeoutMs: 45_000 },
  );
  revalidatePath(`/settings/accounts/${accountId}`);
  return res.ok ? { ok: true, items: res.data.items } : { ok: false, message: res.error };
}
