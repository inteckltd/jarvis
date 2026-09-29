import { z } from "zod";
import {
  CONNECTABLE_PROVIDERS,
  ENVIRONMENTS,
  isAllowedTokenEnvVar,
  RESOURCE_TYPES,
  type ResourceTypeName,
  TOKEN_AUTH_TYPES,
} from "./providers";
import {
  doAppConfigSchema,
  emptyConfigSchema,
  expoAppConfigSchema,
  supabaseProjectConfigSchema,
  vercelProjectConfigSchema,
} from "./schemas";

/** First message per field, keyed by dotted path (e.g. "config.componentName"). */
export function firstFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "_form";
    out[key] ??= issue.message;
  }
  return out;
}

/** Trimmed text; empty becomes null. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Must be ${max} characters or fewer`)
    .transform((v) => (v === "" ? null : v));

const optionalHttpUrl = z
  .string()
  .trim()
  .max(2048)
  .refine((v) => v === "" || /^https?:\/\/[^\s/]+\S*$/i.test(v), "Enter a full http(s) URL")
  .transform((v) => (v === "" ? null : v.replace(/\/+$/, "") || v));

const optionalId = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v));

// --- Provider accounts -------------------------------------------------------

const accountBase = z.object({
  provider: z.enum(CONNECTABLE_PROVIDERS, "Choose a provider"),
  label: z.string().trim().min(1, "Label is required").max(80, "Must be 80 characters or fewer"),
  /** null = Inteck-owned. */
  clientId: optionalId,
  authType: z.enum(TOKEN_AUTH_TYPES, "Choose how the token is provided"),
  envVarName: z
    .string()
    .trim()
    .toUpperCase()
    .transform((v) => (v === "" ? null : v)),
  /** Only for ENCRYPTED_TOKEN. Blank on update keeps the stored token. */
  token: z
    .string()
    .trim()
    .max(4096)
    .transform((v) => (v === "" ? null : v)),
  /** Vercel team ID stored alongside an encrypted token. */
  teamId: optionalText(100),
});

export function providerAccountSchema({ requireToken }: { requireToken: boolean }) {
  return accountBase.superRefine((v, ctx) => {
    if (v.authType === "ENV_TOKEN") {
      if (!v.envVarName) {
        ctx.addIssue({ code: "custom", path: ["envVarName"], message: "Env var name is required" });
      } else if (!isAllowedTokenEnvVar(v.provider, v.envVarName)) {
        ctx.addIssue({
          code: "custom",
          path: ["envVarName"],
          message:
            "Must be the provider's token variable, optionally with a suffix (e.g. DO_API_TOKEN_ACME)",
        });
      }
    }
    if (v.authType === "ENCRYPTED_TOKEN" && requireToken && !v.token) {
      ctx.addIssue({ code: "custom", path: ["token"], message: "Paste the API token" });
    }
    if (v.token && /\s/.test(v.token)) {
      ctx.addIssue({ code: "custom", path: ["token"], message: "Tokens cannot contain spaces" });
    }
  });
}

export type ProviderAccountInput = z.infer<typeof accountBase>;
export type ProviderAccountField = keyof ProviderAccountInput;

// --- Resources ---------------------------------------------------------------

export const RESOURCE_CONFIG_SCHEMAS: Record<
  ResourceTypeName,
  z.ZodType<Record<string, unknown>>
> = {
  DO_APP: doAppConfigSchema,
  DO_DROPLET: emptyConfigSchema,
  SUPABASE_PROJECT: supabaseProjectConfigSchema,
  SUPABASE_FUNCTIONS: emptyConfigSchema,
  VERCEL_PROJECT: vercelProjectConfigSchema,
  EXPO_APP: expoAppConfigSchema,
  AWS_EC2: emptyConfigSchema,
};

/** Config keys editable in the resource form, per type. */
export const RESOURCE_CONFIG_FIELDS: Record<ResourceTypeName, readonly string[]> = {
  DO_APP: ["componentName"],
  DO_DROPLET: [],
  SUPABASE_PROJECT: [],
  SUPABASE_FUNCTIONS: [],
  VERCEL_PROJECT: ["branch", "target"],
  EXPO_APP: ["bundleId", "iosAppId", "androidPackage"],
  AWS_EC2: [],
};

export const resourceInputSchema = z
  .object({
    clientId: z.string().trim().min(1, "Choose a client"),
    providerAccountId: z.string().trim().min(1, "Choose a provider account"),
    type: z.enum(RESOURCE_TYPES, "Choose a resource type"),
    externalId: z
      .string()
      .trim()
      .min(1, "External ID is required")
      .max(200, "Must be 200 characters or fewer"),
    name: z.string().trim().min(1, "Name is required").max(120, "Must be 120 characters or fewer"),
    environment: z.enum(ENVIRONMENTS, "Choose an environment"),
    region: optionalText(64),
    liveUrl: optionalHttpUrl,
    healthCheckUrl: optionalHttpUrl,
    repositoryId: optionalId,
    active: z.boolean(),
    config: z.record(z.string(), z.string()),
  })
  .transform((v, ctx) => {
    const cleaned = Object.fromEntries(
      Object.entries(v.config)
        .map(([k, val]) => [k, val.trim()] as const)
        .filter(([, val]) => val !== ""),
    );
    const parsed = RESOURCE_CONFIG_SCHEMAS[v.type].safeParse(cleaned);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        ctx.addIssue({
          code: "custom",
          path: ["config", ...issue.path.map(String)],
          message: issue.path[0] === "componentName" ? "Component name is required" : issue.message,
        });
      }
      return z.NEVER;
    }
    const config: Record<string, string> = {};
    for (const [k, val] of Object.entries(parsed.data)) {
      if (typeof val === "string") config[k] = val;
    }
    return { ...v, config };
  });

export type ResourceInput = z.infer<typeof resourceInputSchema>;

// --- Repositories ------------------------------------------------------------

const branchName = z
  .string()
  .trim()
  .max(255, "Branch name is too long")
  .refine(
    (v) => v === "" || (/^[A-Za-z0-9._/-]+$/.test(v) && !v.startsWith("-") && !v.includes("..")),
    "Not a valid branch name",
  );

export const repositoryInputSchema = z
  .object({
    owner: z
      .string()
      .trim()
      .min(1, "Owner is required")
      .max(39, "GitHub owners are at most 39 characters")
      .regex(/^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/, "Letters, numbers and hyphens only"),
    name: z
      .string()
      .trim()
      .min(1, "Repository name is required")
      .max(100, "Must be 100 characters or fewer")
      .regex(/^[A-Za-z0-9._-]+$/, "Letters, numbers, '.', '_' and '-' only"),
    productionBranch: branchName.refine((v) => v !== "", "Production branch is required"),
    developmentBranch: branchName.transform((v) => (v === "" ? null : v)),
    active: z.boolean(),
  })
  .refine((v) => v.developmentBranch !== v.productionBranch, {
    path: ["developmentBranch"],
    message: "Must differ from the production branch",
  });

export type RepositoryInput = z.infer<typeof repositoryInputSchema>;
export type RepositoryField = keyof RepositoryInput;

/**
 * Accepts "owner/name", "https://github.com/owner/name(.git)" or "git@github.com:owner/name.git".
 * Returns null if it doesn't look like a GitHub reference.
 */
export function parseRepoRef(input: string): { owner: string; name: string } | null {
  const trimmed = input
    .trim()
    .replace(/\.git$/, "")
    .replace(/\/+$/, "");
  const match =
    /^(?:https?:\/\/(?:www\.)?github\.com\/|git@github\.com:)?([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+)$/.exec(
      trimmed,
    );
  return match?.[1] && match[2] ? { owner: match[1], name: match[2] } : null;
}
