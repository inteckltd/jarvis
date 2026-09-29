import { z } from "zod";

// String unions mirroring the Prisma enums, so shared code (and the browser)
// never needs to import @prisma/client.

export const PROVIDERS = ["DIGITALOCEAN", "AWS", "SUPABASE", "VERCEL", "EXPO"] as const;
export type ProviderName = (typeof PROVIDERS)[number];

export const AUTH_TYPES = [
  "ENV_TOKEN",
  "ENCRYPTED_TOKEN",
  "AWS_ASSUME_ROLE",
  "AWS_ACCESS_KEY",
] as const;
export type AuthTypeName = (typeof AUTH_TYPES)[number];

export const ENVIRONMENTS = ["PRODUCTION", "DEVELOPMENT", "NONE"] as const;
export type EnvironmentName = (typeof ENVIRONMENTS)[number];

export const RESOURCE_TYPES = [
  "DO_APP",
  "DO_DROPLET",
  "SUPABASE_PROJECT",
  "SUPABASE_FUNCTIONS",
  "VERCEL_PROJECT",
  "EXPO_APP",
  "AWS_EC2",
] as const;
export type ResourceTypeName = (typeof RESOURCE_TYPES)[number];

export const RESOURCE_TYPE_PROVIDER: Record<ResourceTypeName, ProviderName> = {
  DO_APP: "DIGITALOCEAN",
  DO_DROPLET: "DIGITALOCEAN",
  SUPABASE_PROJECT: "SUPABASE",
  SUPABASE_FUNCTIONS: "SUPABASE",
  VERCEL_PROJECT: "VERCEL",
  EXPO_APP: "EXPO",
  AWS_EC2: "AWS",
};

/** Providers that can be connected today. AWS stays in the model for later. */
export const CONNECTABLE_PROVIDERS = ["DIGITALOCEAN", "SUPABASE", "VERCEL", "EXPO"] as const;
export type ConnectableProvider = (typeof CONNECTABLE_PROVIDERS)[number];

export function isConnectableProvider(p: string): p is ConnectableProvider {
  return (CONNECTABLE_PROVIDERS as readonly string[]).includes(p);
}

/** Token-based auth types usable with the connectable providers. */
export const TOKEN_AUTH_TYPES = ["ENV_TOKEN", "ENCRYPTED_TOKEN"] as const;
export type TokenAuthType = (typeof TOKEN_AUTH_TYPES)[number];

export const DEFAULT_TOKEN_ENV_VAR: Record<ConnectableProvider, string> = {
  DIGITALOCEAN: "DO_API_TOKEN",
  SUPABASE: "SUPABASE_ACCESS_TOKEN",
  VERCEL: "VERCEL_TOKEN",
  EXPO: "EXPO_TOKEN",
};

/**
 * ENV_TOKEN accounts may only reference the provider's token variable, optionally
 * with an uppercase suffix for extra accounts (e.g. DO_API_TOKEN_ACME). This stops
 * an account from pointing at unrelated secrets such as ENCRYPTION_KEY.
 */
export function isAllowedTokenEnvVar(provider: ConnectableProvider, name: string): boolean {
  const base = DEFAULT_TOKEN_ENV_VAR[provider];
  return name === base || new RegExp(`^${base}_[A-Z0-9]+(?:_[A-Z0-9]+)*$`).test(name);
}

/** VERCEL_TOKEN -> VERCEL_TEAM_ID, VERCEL_TOKEN_ACME -> VERCEL_TEAM_ID_ACME. */
export function vercelTeamEnvVar(tokenEnvVar: string): string {
  return tokenEnvVar.replace(/^VERCEL_TOKEN/, "VERCEL_TEAM_ID");
}

/** Resource types each provider's discovery can return. */
export const DISCOVERABLE_TYPES: Record<ConnectableProvider, readonly ResourceTypeName[]> = {
  DIGITALOCEAN: ["DO_APP"],
  SUPABASE: ["SUPABASE_PROJECT", "SUPABASE_FUNCTIONS"],
  VERCEL: ["VERCEL_PROJECT"],
  EXPO: ["EXPO_APP"],
};

const DEV_NAME_PATTERN =
  /(?:^|[-_.\s])(dev|develop|development|staging|stage|stg|preprod|pre-prod|pre-production|preview|test|qa|uat)(?:$|[-_.\s])/i;
const PROD_BRANCHES = new Set(["main", "master", "production", "prod", "release"]);
const DEV_BRANCHES =
  /^(dev|develop|development|staging|stage|preprod|pre-prod|pre-production|preview|test|qa|uat)$/i;

/**
 * Best-guess environment for a discovered resource, from its name and the branch it
 * deploys. A development-looking name wins over the branch, because separate dev
 * apps are sometimes (wrongly) deployed from main. The user always confirms.
 */
export function suggestEnvironment(input: {
  name: string;
  branch?: string | null;
}): Exclude<EnvironmentName, "NONE"> {
  if (DEV_NAME_PATTERN.test(input.name)) return "DEVELOPMENT";
  const branch = input.branch?.trim();
  if (branch && DEV_BRANCHES.test(branch)) return "DEVELOPMENT";
  if (branch && PROD_BRANCHES.has(branch.toLowerCase())) return "PRODUCTION";
  return "PRODUCTION";
}

/** Default health check for a resource type: {liveUrl}/health for APIs, the site itself for web apps. */
export function defaultHealthCheckUrl(
  type: ResourceTypeName,
  liveUrl: string | null | undefined,
): string | null {
  if (!liveUrl) return null;
  const base = liveUrl.replace(/\/+$/, "");
  switch (type) {
    case "DO_APP":
    case "DO_DROPLET":
    case "AWS_EC2":
      return `${base}/health`;
    case "VERCEL_PROJECT":
      return base;
    default:
      return null;
  }
}

/** A resource as returned by a provider's discovery endpoint (apps/api -> apps/web). */
export const discoveredResourceSchema = z.object({
  type: z.enum(RESOURCE_TYPES),
  externalId: z.string().min(1),
  name: z.string(),
  region: z.string().nullable(),
  liveUrl: z.string().nullable(),
  suggestedEnvironment: z.enum(ENVIRONMENTS),
  suggestedHealthCheckUrl: z.string().nullable(),
  /** Branch currently deployed / production branch, when the provider reports one. */
  branch: z.string().nullable(),
  repository: z.object({ owner: z.string(), name: z.string() }).nullable(),
  /** Provider-specific config suggestions (e.g. DO componentName). */
  config: z.record(z.string(), z.string()),
  /** DO: all service/worker components, so the user can pick the primary one. */
  components: z.array(z.string()),
  status: z.string().nullable(),
  imported: z.array(
    z.object({
      resourceId: z.string(),
      environment: z.enum(ENVIRONMENTS),
      clientName: z.string(),
      clientSlug: z.string(),
    }),
  ),
});
export type DiscoveredResource = z.infer<typeof discoveredResourceSchema>;

export const discoveryResultSchema = z.object({ items: z.array(discoveredResourceSchema) });

export const connectionTestResultSchema = z.object({
  ok: z.boolean(),
  message: z.string(),
  verifiedAt: z.string().nullable(),
});
export type ConnectionTestResult = z.infer<typeof connectionTestResultSchema>;

export const CREDENTIAL_STATUSES = ["ok", "missing", "unreadable", "unsupported"] as const;
export type CredentialStatus = (typeof CREDENTIAL_STATUSES)[number];

export const credentialStatusListSchema = z.object({
  accounts: z.array(
    z.object({
      id: z.string(),
      status: z.enum(CREDENTIAL_STATUSES),
      /** e.g. "••••3f9a"; never the full token. */
      masked: z.string().nullable(),
      detail: z.string().nullable(),
    }),
  ),
});
export type CredentialStatusList = z.infer<typeof credentialStatusListSchema>;
