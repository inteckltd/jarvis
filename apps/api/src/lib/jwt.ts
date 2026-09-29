import {
  createRemoteJWKSet,
  decodeProtectedHeader,
  errors as joseErrors,
  jwtVerify,
  type JWTVerifyGetKey,
} from "jose";
import { z } from "zod";

export type VerifiedUser = { sub: string; email: string };
export type JwtVerifier = (token: string) => Promise<VerifiedUser>;

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

/** Supabase Auth (JWKS or user endpoint) could not be reached; the token was not judged. */
export class AuthUnavailableError extends Error {
  constructor(cause: unknown) {
    super("Auth provider unavailable", { cause });
    this.name = "AuthUnavailableError";
  }
}

const claimsSchema = z.object({
  sub: z.string().min(1),
  email: z.string().min(1),
});

const legacyUserSchema = z.object({
  id: z.string().min(1),
  email: z.string().min(1),
});

type LegacyVerify = (token: string) => Promise<VerifiedUser | null>;

export type VerifierOptions = {
  supabaseUrl: string;
  anonKey: string;
  allowedEmail: string;
  /** Override the key source (tests). Defaults to the project's JWKS endpoint. */
  getKey?: JWTVerifyGetKey;
  /** Override the legacy HS256 fallback (tests). */
  legacyVerify?: LegacyVerify;
};

const LEGACY_CACHE_MS = 60_000;

/**
 * Projects using legacy symmetric (HS256) JWT secrets can't be verified with JWKS,
 * so ask Supabase Auth who the token belongs to, caching briefly.
 */
function createLegacyVerify(supabaseUrl: string, anonKey: string): LegacyVerify {
  const cache = new Map<string, { user: VerifiedUser | null; expires: number }>();
  return async (token) => {
    const hit = cache.get(token);
    if (hit && hit.expires > Date.now()) return hit.user;

    const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
    });
    let user: VerifiedUser | null = null;
    if (res.ok) {
      const parsed = legacyUserSchema.safeParse(await res.json());
      if (parsed.success) user = { sub: parsed.data.id, email: parsed.data.email };
    }
    if (cache.size > 100) cache.clear();
    cache.set(token, { user, expires: Date.now() + LEGACY_CACHE_MS });
    return user;
  };
}

export function createSupabaseJwtVerifier(options: VerifierOptions): JwtVerifier {
  const base = options.supabaseUrl.replace(/\/+$/, "");
  const issuer = `${base}/auth/v1`;
  const getKey = options.getKey ?? createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));
  const legacyVerify = options.legacyVerify ?? createLegacyVerify(base, options.anonKey);
  const allowed = options.allowedEmail.trim().toLowerCase();

  const assertAllowed = (user: VerifiedUser): VerifiedUser => {
    if (user.email.trim().toLowerCase() !== allowed) throw new AuthError("Email not allowed");
    return user;
  };

  return async (token) => {
    let alg: string | undefined;
    try {
      alg = decodeProtectedHeader(token).alg;
    } catch {
      throw new AuthError("Malformed token");
    }

    if (alg === "HS256") {
      let user: VerifiedUser | null;
      try {
        user = await legacyVerify(token);
      } catch (error) {
        throw new AuthUnavailableError(error);
      }
      if (!user) throw new AuthError("Invalid token");
      return assertAllowed(user);
    }

    try {
      const { payload } = await jwtVerify(token, getKey, { issuer, audience: "authenticated" });
      const claims = claimsSchema.safeParse(payload);
      if (!claims.success) throw new AuthError("Token is missing required claims");
      return assertAllowed(claims.data);
    } catch (error) {
      if (error instanceof AuthError) throw error;
      if (error instanceof joseErrors.JWKSTimeout) throw new AuthUnavailableError(error);
      if (error instanceof joseErrors.JOSEError) throw new AuthError(error.code);
      // Network failure fetching the JWKS.
      throw new AuthUnavailableError(error);
    }
  };
}
