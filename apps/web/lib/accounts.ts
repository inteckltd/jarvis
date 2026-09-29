import "server-only";
import { credentialStatusListSchema, type CredentialStatusList } from "@jarvis/shared";
import { apiFetch } from "@/lib/api";

export type CredentialStatusMap = Map<string, CredentialStatusList["accounts"][number]>;

/** Credential status per account from apps/api, or null when the API is unreachable. */
export async function loadCredentialStatuses(): Promise<CredentialStatusMap | null> {
  const res = await apiFetch("/v1/provider-accounts/credentials", credentialStatusListSchema);
  if (!res.ok) return null;
  return new Map(res.data.accounts.map((a) => [a.id, a]));
}

/** Fields that are safe to load into apps/web. Never select encryptedCredentials here. */
export const ACCOUNT_PUBLIC_SELECT = {
  id: true,
  label: true,
  provider: true,
  authType: true,
  envVarName: true,
  clientId: true,
  lastVerifiedAt: true,
  lastError: true,
  createdAt: true,
  client: { select: { id: true, name: true, slug: true } },
  _count: { select: { resources: true } },
} as const;
