import {
  isAllowedTokenEnvVar,
  isConnectableProvider,
  vercelTeamEnvVar,
  type CredentialStatus,
} from "@jarvis/shared";
import { z } from "zod";
import { DecryptError, type SecretBox } from "../lib/crypto";

/** A resolved credential. Lives only in apps/api memory; never serialised to responses or logs. */
export type Credential = { token: string; teamId: string | null };

/** The account fields credential resolution needs (no Prisma types, for testability). */
export type CredentialSource = {
  provider: string;
  authType: string;
  envVarName: string | null;
  encryptedCredentials: string | null;
};

export class CredentialError extends Error {
  constructor(
    readonly status: Exclude<CredentialStatus, "ok">,
    message: string,
  ) {
    super(message);
    this.name = "CredentialError";
  }
}

const storedCredentialSchema = z.object({
  token: z.string().min(1),
  teamId: z.string().min(1).nullable().optional(),
});

export function serializeCredential(box: SecretBox, credential: Credential): string {
  return box.encrypt(JSON.stringify({ token: credential.token, teamId: credential.teamId }));
}

export function resolveCredential(
  account: CredentialSource,
  deps: { env: NodeJS.ProcessEnv; box: SecretBox | null },
): Credential {
  if (!isConnectableProvider(account.provider)) {
    throw new CredentialError("unsupported", `${account.provider} accounts are not supported yet`);
  }

  if (account.authType === "ENV_TOKEN") {
    const name = account.envVarName ?? "";
    if (!isAllowedTokenEnvVar(account.provider, name)) {
      throw new CredentialError(
        "unsupported",
        `Env var "${name}" is not allowed for this provider`,
      );
    }
    const token = deps.env[name]?.trim();
    if (!token) throw new CredentialError("missing", `${name} is not set in the API environment`);
    const teamId =
      account.provider === "VERCEL" ? deps.env[vercelTeamEnvVar(name)]?.trim() || null : null;
    return { token, teamId };
  }

  if (account.authType === "ENCRYPTED_TOKEN") {
    if (!account.encryptedCredentials) {
      throw new CredentialError("missing", "No token has been stored for this account");
    }
    if (!deps.box) {
      throw new CredentialError("unreadable", "ENCRYPTION_KEY is not configured on the API");
    }
    let plaintext: string;
    try {
      plaintext = deps.box.decrypt(account.encryptedCredentials);
    } catch (error) {
      if (error instanceof DecryptError) throw new CredentialError("unreadable", error.message);
      throw error;
    }
    const parsed = storedCredentialSchema.safeParse(safeJson(plaintext));
    if (!parsed.success) throw new CredentialError("unreadable", "Stored credential is malformed");
    return { token: parsed.data.token, teamId: parsed.data.teamId ?? null };
  }

  throw new CredentialError("unsupported", `${account.authType} is not supported yet`);
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** "••••3f9a" — only the last four characters, and only for tokens long enough to stay secret. */
export function maskToken(token: string): string {
  return token.length >= 16 ? `••••${token.slice(-4)}` : "••••";
}
