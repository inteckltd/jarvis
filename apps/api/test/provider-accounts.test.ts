import { randomBytes } from "node:crypto";
import { type PrismaClient } from "@jarvis/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { serializeCredential } from "../src/integrations/credentials";
import { type DiscoveryProvider } from "../src/integrations/types";
import { createSecretBox } from "../src/lib/crypto";
import { buildServer } from "../src/server";

type Account = {
  id: string;
  provider: string;
  authType: string;
  label: string;
  clientId: string | null;
  envVarName: string | null;
  encryptedCredentials: string | null;
  lastVerifiedAt: Date | null;
  lastError: string | null;
};

const box = createSecretBox(randomBytes(32));
const ENV_TOKEN = "dop_v1_env_secret_0123456789";
const STORED_TOKEN = "sbp_stored_secret_abcdefghij";

const accounts: Account[] = [];
const created: Array<Record<string, unknown>> = [];

// Minimal in-memory stand-in for the Prisma calls these routes make.
const db = {
  client: { count: async () => 1 },
  providerAccount: {
    findMany: async () => accounts,
    findUnique: async ({ where }: { where: { id: string } }) =>
      accounts.find((a) => a.id === where.id) ?? null,
    create: async ({ data }: { data: Record<string, unknown> }) => {
      created.push(data);
      return { id: `acc_${created.length}` };
    },
    update: async ({ where, data }: { where: { id: string }; data: Partial<Account> }) => {
      const account = accounts.find((a) => a.id === where.id);
      if (account) Object.assign(account, data);
      return account;
    },
  },
  resource: { findMany: async () => [] },
} as unknown as PrismaClient;

const okDiscovery = (provider: DiscoveryProvider["provider"]): DiscoveryProvider => ({
  provider,
  testConnection: async ({ token }) => `ok:${token.length}`,
  listResources: async () => [],
});

type App = Awaited<ReturnType<typeof buildServer>>;
let app: App;

beforeAll(async () => {
  accounts.push(
    {
      id: "env",
      provider: "DIGITALOCEAN",
      authType: "ENV_TOKEN",
      label: "DO",
      clientId: null,
      envVarName: "DO_API_TOKEN",
      encryptedCredentials: null,
      lastVerifiedAt: null,
      lastError: null,
    },
    {
      id: "stored",
      provider: "SUPABASE",
      authType: "ENCRYPTED_TOKEN",
      label: "Supabase",
      clientId: null,
      envVarName: null,
      encryptedCredentials: serializeCredential(box, { token: STORED_TOKEN, teamId: null }),
      lastVerifiedAt: null,
      lastError: null,
    },
    {
      id: "missing",
      provider: "EXPO",
      authType: "ENV_TOKEN",
      label: "Expo",
      clientId: null,
      envVarName: "EXPO_TOKEN",
      encryptedCredentials: null,
      lastVerifiedAt: null,
      lastError: null,
    },
  );

  app = await buildServer({
    verify: async () => ({ sub: "u1", email: "owner@inteck.example" }),
    integrations: {
      db,
      box,
      env: { DO_API_TOKEN: ENV_TOKEN },
      discovery: {
        DIGITALOCEAN: okDiscovery("DIGITALOCEAN"),
        SUPABASE: okDiscovery("SUPABASE"),
        VERCEL: okDiscovery("VERCEL"),
        EXPO: okDiscovery("EXPO"),
      },
    },
  });
});

afterAll(async () => {
  await app.close();
});

const auth = { authorization: "Bearer test" };

describe("provider account routes", () => {
  it("reports credential status with masked values only", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/v1/provider-accounts/credentials",
      headers: auth,
    });
    expect(res.statusCode).toBe(200);
    expect(res.body).not.toContain(ENV_TOKEN);
    expect(res.body).not.toContain(STORED_TOKEN);
    expect(res.json()).toEqual({
      accounts: [
        { id: "env", status: "ok", masked: "••••6789", detail: null },
        { id: "stored", status: "ok", masked: "••••ghij", detail: null },
        {
          id: "missing",
          status: "missing",
          masked: null,
          detail: "EXPO_TOKEN is not set in the API environment",
        },
      ],
    });
  });

  it("requires auth", async () => {
    const open = await buildServer({
      verify: async () => {
        throw new Error("should not be called");
      },
      integrations: { db },
    });
    const res = await open.inject({ method: "GET", url: "/v1/provider-accounts/credentials" });
    await open.close();
    expect(res.statusCode).toBe(401);
  });

  it("rejects env var names outside the provider allow-list", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/provider-accounts",
      headers: auth,
      payload: {
        provider: "DIGITALOCEAN",
        label: "Sneaky",
        clientId: "",
        authType: "ENV_TOKEN",
        envVarName: "ENCRYPTION_KEY",
        token: "",
        teamId: "",
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().fieldErrors).toHaveProperty("envVarName");
  });

  it("stores pasted tokens encrypted", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/provider-accounts",
      headers: auth,
      payload: {
        provider: "VERCEL",
        label: "Client Vercel",
        clientId: "",
        authType: "ENCRYPTED_TOKEN",
        envVarName: "",
        token: "vercel_pasted_token_value",
        teamId: "team_42",
      },
    });
    expect(res.statusCode).toBe(201);
    expect(res.body).not.toContain("vercel_pasted_token_value");
    const data = created.at(-1) ?? {};
    expect(typeof data.encryptedCredentials).toBe("string");
    expect(String(data.encryptedCredentials)).not.toContain("vercel_pasted_token_value");
    expect(JSON.parse(box.decrypt(String(data.encryptedCredentials)))).toEqual({
      token: "vercel_pasted_token_value",
      teamId: "team_42",
    });
  });

  it("records the outcome of a connection test", async () => {
    const ok = await app.inject({
      method: "POST",
      url: "/v1/provider-accounts/env/test",
      headers: auth,
    });
    expect(ok.json()).toMatchObject({ ok: true, message: `ok:${ENV_TOKEN.length}` });
    expect(accounts[0]?.lastVerifiedAt).toBeInstanceOf(Date);

    const failed = await app.inject({
      method: "POST",
      url: "/v1/provider-accounts/missing/test",
      headers: auth,
    });
    expect(failed.json()).toMatchObject({
      ok: false,
      message: "EXPO_TOKEN is not set in the API environment",
    });
    expect(accounts[2]?.lastError).toBe("EXPO_TOKEN is not set in the API environment");
  });

  it("returns 502 with a safe message when discovery fails", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/v1/provider-accounts/missing/discover",
      headers: auth,
    });
    expect(res.statusCode).toBe(502);
    expect(res.json().message).toBe("EXPO_TOKEN is not set in the API environment");
  });
});
