import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const VERSION = "v1";
const IV_BYTES = 12;
const TAG_BYTES = 16;

export class DecryptError extends Error {
  constructor() {
    super("Stored secret could not be decrypted (wrong ENCRYPTION_KEY or corrupted value)");
    this.name = "DecryptError";
  }
}

export type SecretBox = {
  encrypt(plaintext: string): string;
  decrypt(ciphertext: string): string;
};

/** Parses ENCRYPTION_KEY: 32 random bytes, base64. */
export function parseEncryptionKey(value: string): Buffer {
  const key = Buffer.from(value.trim(), "base64");
  if (key.length !== 32) {
    throw new Error("ENCRYPTION_KEY must be 32 bytes, base64-encoded (openssl rand -base64 32)");
  }
  return key;
}

/**
 * AES-256-GCM. Output format: "v1:<iv>:<tag>:<ciphertext>" (base64 parts), so the
 * scheme can be rotated later without guessing at stored values.
 */
export function createSecretBox(key: Buffer): SecretBox {
  if (key.length !== 32) throw new Error("AES-256-GCM needs a 32-byte key");

  return {
    encrypt(plaintext) {
      const iv = randomBytes(IV_BYTES);
      const cipher = createCipheriv("aes-256-gcm", key, iv);
      const body = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
      const tag = cipher.getAuthTag();
      return [VERSION, iv.toString("base64"), tag.toString("base64"), body.toString("base64")].join(
        ":",
      );
    },
    decrypt(ciphertext) {
      const [version, ivB64, tagB64, bodyB64] = ciphertext.split(":");
      if (version !== VERSION || !ivB64 || !tagB64 || bodyB64 === undefined) {
        throw new DecryptError();
      }
      const iv = Buffer.from(ivB64, "base64");
      const tag = Buffer.from(tagB64, "base64");
      if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) throw new DecryptError();
      try {
        const decipher = createDecipheriv("aes-256-gcm", key, iv);
        decipher.setAuthTag(tag);
        return Buffer.concat([
          decipher.update(Buffer.from(bodyB64, "base64")),
          decipher.final(),
        ]).toString("utf8");
      } catch {
        throw new DecryptError();
      }
    },
  };
}
