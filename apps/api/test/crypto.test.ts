import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  CredentialError,
  maskToken,
  resolveCredential,
  serializeCredential,
} from "../src/integrations/credentials";
import { createSecretBox, DecryptError, parseEncryptionKey } from "../src/lib/crypto";

const box = createSecretBox(randomBytes(32));

describe("secret box (AES-256-GCM)", () => {
  it("round-trips and uses a fresh IV each time", () => {
    const a = box.encrypt("dop_v1_secret");
    const b = box.encrypt("dop_v1_secret");
    expect(a).not.toBe(b);
    expect(a.startsWith("v1:")).toBe(true);
    expect(a).not.toContain("dop_v1_secret");
    expect(box.decrypt(a)).toBe("dop_v1_secret");
  });

  it("rejects tampered ciphertext", () => {
    const [v, iv, tag, body] = box.encrypt("hello").split(":");
    const flipped = Buffer.from(body ?? "", "base64");
    flipped[0] = (flipped[0] ?? 0) ^ 0xff;
    expect(() => box.decrypt([v, iv, tag, flipped.toString("base64")].join(":"))).toThrow(
      DecryptError,
    );
  });

  it("rejects a different key", () => {
    const other = createSecretBox(randomBytes(32));
    expect(() => other.decrypt(box.encrypt("hello"))).toThrow(DecryptError);
  });

  it("rejects malformed input", () => {
    expect(() => box.decrypt("not-encrypted")).toThrow(DecryptError);
    expect(() => box.decrypt("v2:a:b:c")).toThrow(DecryptError);
  });

  it("validates the key length", () => {
    expect(() => parseEncryptionKey(randomBytes(16).toString("base64"))).toThrow(/32 bytes/);
    expect(parseEncryptionKey(randomBytes(32).toString("base64"))).toHaveLength(32);
  });
});

describe("resolveCredential", () => {
  const env = {
    DO_API_TOKEN: "dop_v1_env_token_value",
    VERCEL_TOKEN_ACME: "vercel_token_value",
    VERCEL_TEAM_ID_ACME: "team_123",
    ENCRYPTION_KEY: "should-never-be-read",
  };

  it("reads env tokens", () => {
    expect(
      resolveCredential(
        {
          provider: "DIGITALOCEAN",
          authType: "ENV_TOKEN",
          envVarName: "DO_API_TOKEN",
          encryptedCredentials: null,
        },
        { env, box },
      ),
    ).toEqual({ token: "dop_v1_env_token_value", teamId: null });
  });

  it("pairs Vercel tokens with the matching team variable", () => {
    expect(
      resolveCredential(
        {
          provider: "VERCEL",
          authType: "ENV_TOKEN",
          envVarName: "VERCEL_TOKEN_ACME",
          encryptedCredentials: null,
        },
        { env, box },
      ),
    ).toEqual({ token: "vercel_token_value", teamId: "team_123" });
  });

  it("refuses env vars outside the allow-list", () => {
    expect(() =>
      resolveCredential(
        {
          provider: "DIGITALOCEAN",
          authType: "ENV_TOKEN",
          envVarName: "ENCRYPTION_KEY",
          encryptedCredentials: null,
        },
        { env, box },
      ),
    ).toThrow(CredentialError);
  });

  it("reports a missing env var", () => {
    try {
      resolveCredential(
        {
          provider: "EXPO",
          authType: "ENV_TOKEN",
          envVarName: "EXPO_TOKEN",
          encryptedCredentials: null,
        },
        { env, box },
      );
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(CredentialError);
      expect((error as CredentialError).status).toBe("missing");
    }
  });

  it("decrypts stored tokens", () => {
    const stored = serializeCredential(box, { token: "sbp_stored", teamId: null });
    expect(
      resolveCredential(
        {
          provider: "SUPABASE",
          authType: "ENCRYPTED_TOKEN",
          envVarName: null,
          encryptedCredentials: stored,
        },
        { env, box },
      ),
    ).toEqual({ token: "sbp_stored", teamId: null });
  });

  it("reports unreadable stored tokens without an encryption key", () => {
    const stored = serializeCredential(box, { token: "sbp_stored", teamId: null });
    expect(() =>
      resolveCredential(
        {
          provider: "SUPABASE",
          authType: "ENCRYPTED_TOKEN",
          envVarName: null,
          encryptedCredentials: stored,
        },
        { env, box: null },
      ),
    ).toThrow(/ENCRYPTION_KEY/);
  });
});

describe("maskToken", () => {
  it("shows at most the last four characters", () => {
    expect(maskToken("dop_v1_0123456789abcdef")).toBe("••••cdef");
    expect(maskToken("short")).toBe("••••");
  });
});
