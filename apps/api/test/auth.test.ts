import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createSupabaseJwtVerifier } from "../src/lib/jwt";
import { buildServer } from "../src/server";

const SUPABASE_URL = "https://test-project.supabase.co";
const ISSUER = `${SUPABASE_URL}/auth/v1`;
const ALLOWED = "owner@inteck.example";

type App = Awaited<ReturnType<typeof buildServer>>;
type KeyPair = Awaited<ReturnType<typeof generateKeyPair>>;

let app: App;
let keys: KeyPair;
let otherKeys: KeyPair;

async function sign(
  claims: Record<string, unknown>,
  opts: { key?: KeyPair; issuer?: string; audience?: string; expiresIn?: string | number } = {},
) {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "ES256", kid: "test-key" })
    .setIssuer(opts.issuer ?? ISSUER)
    .setAudience(opts.audience ?? "authenticated")
    .setSubject(typeof claims.sub === "string" ? claims.sub : "user-1")
    .setIssuedAt()
    .setExpirationTime(opts.expiresIn ?? "1h")
    .sign((opts.key ?? keys).privateKey);
}

beforeAll(async () => {
  keys = await generateKeyPair("ES256");
  otherKeys = await generateKeyPair("ES256");
  const jwk = { ...(await exportJWK(keys.publicKey)), kid: "test-key", alg: "ES256" };

  app = await buildServer({
    verify: createSupabaseJwtVerifier({
      supabaseUrl: SUPABASE_URL,
      anonKey: "anon",
      allowedEmail: ALLOWED,
      getKey: createLocalJWKSet({ keys: [jwk] }),
      legacyVerify: async () => null,
    }),
  });
});

afterAll(async () => {
  await app.close();
});

async function me(token?: string) {
  return app.inject({
    method: "GET",
    url: "/v1/me",
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

describe("API auth", () => {
  it("serves /health without a token", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: "ok" });
  });

  it("accepts a valid token for ALLOWED_EMAIL", async () => {
    const res = await me(await sign({ sub: "user-1", email: ALLOWED }));
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ sub: "user-1", email: ALLOWED });
  });

  it("compares the email case-insensitively", async () => {
    const res = await me(await sign({ sub: "user-1", email: "Owner@Inteck.Example" }));
    expect(res.statusCode).toBe(200);
  });

  it("rejects a missing token", async () => {
    expect((await me()).statusCode).toBe(401);
  });

  it("rejects a malformed token", async () => {
    expect((await me("not-a-jwt")).statusCode).toBe(401);
  });

  it("rejects a valid token for a different email", async () => {
    const res = await me(await sign({ sub: "user-2", email: "someone@else.example" }));
    expect(res.statusCode).toBe(401);
  });

  it("rejects a token without an email claim", async () => {
    expect((await me(await sign({ sub: "user-1" }))).statusCode).toBe(401);
  });

  it("rejects an expired token", async () => {
    const token = await sign(
      { sub: "user-1", email: ALLOWED },
      { expiresIn: Math.floor(Date.now() / 1000) - 60 },
    );
    expect((await me(token)).statusCode).toBe(401);
  });

  it("rejects a token signed with a different key", async () => {
    const token = await sign({ sub: "user-1", email: ALLOWED }, { key: otherKeys });
    expect((await me(token)).statusCode).toBe(401);
  });

  it("rejects a token from a different issuer", async () => {
    const token = await sign(
      { sub: "user-1", email: ALLOWED },
      { issuer: "https://evil.supabase.co/auth/v1" },
    );
    expect((await me(token)).statusCode).toBe(401);
  });

  it("rejects a token with the wrong audience", async () => {
    const token = await sign({ sub: "user-1", email: ALLOWED }, { audience: "anon" });
    expect((await me(token)).statusCode).toBe(401);
  });

  it("returns 503 (not 401/500) when the JWKS cannot be fetched", async () => {
    const offline = await buildServer({
      verify: createSupabaseJwtVerifier({
        supabaseUrl: SUPABASE_URL,
        anonKey: "anon",
        allowedEmail: ALLOWED,
        getKey: async () => {
          throw new TypeError("fetch failed");
        },
        legacyVerify: async () => null,
      }),
    });
    const res = await offline.inject({
      method: "GET",
      url: "/v1/me",
      headers: { authorization: `Bearer ${await sign({ sub: "user-1", email: ALLOWED })}` },
    });
    await offline.close();
    expect(res.statusCode).toBe(503);
    expect(res.body).not.toContain("fetch failed");
  });

  it("requires auth on unknown routes", async () => {
    const res = await app.inject({ method: "GET", url: "/v1/nope" });
    expect(res.statusCode).toBe(401);
  });
});
