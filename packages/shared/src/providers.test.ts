import { describe, expect, it } from "vitest";
import {
  defaultHealthCheckUrl,
  isAllowedTokenEnvVar,
  suggestEnvironment,
  vercelTeamEnvVar,
} from "./providers";

describe("suggestEnvironment", () => {
  it.each([
    ["ids-workforce-api-dev", null],
    ["ids-workforce-api-staging", "main"],
    ["html-pdf-api-preprod", null],
    ["simplx-ui-pre-production", null],
    ["IDS Dev", null],
    ["dev-api", null],
  ])("treats %s as DEVELOPMENT", (name, branch) => {
    expect(suggestEnvironment({ name, branch })).toBe("DEVELOPMENT");
  });

  it("uses a development branch when the name is neutral", () => {
    expect(suggestEnvironment({ name: "workforce-api", branch: "pre-production" })).toBe(
      "DEVELOPMENT",
    );
    expect(suggestEnvironment({ name: "workforce-api", branch: "develop" })).toBe("DEVELOPMENT");
  });

  it("defaults to PRODUCTION", () => {
    expect(suggestEnvironment({ name: "workforce-api", branch: "main" })).toBe("PRODUCTION");
    expect(suggestEnvironment({ name: "workforce-api" })).toBe("PRODUCTION");
    expect(suggestEnvironment({ name: "developer-portal", branch: null })).toBe("PRODUCTION");
    expect(suggestEnvironment({ name: "latest-news", branch: "feature/x" })).toBe("PRODUCTION");
  });
});

describe("isAllowedTokenEnvVar", () => {
  it("accepts the default variable and suffixed variants", () => {
    expect(isAllowedTokenEnvVar("DIGITALOCEAN", "DO_API_TOKEN")).toBe(true);
    expect(isAllowedTokenEnvVar("DIGITALOCEAN", "DO_API_TOKEN_ACME")).toBe(true);
    expect(isAllowedTokenEnvVar("VERCEL", "VERCEL_TOKEN_CLIENT_2")).toBe(true);
  });

  it("rejects unrelated or cross-provider variables", () => {
    expect(isAllowedTokenEnvVar("DIGITALOCEAN", "ENCRYPTION_KEY")).toBe(false);
    expect(isAllowedTokenEnvVar("DIGITALOCEAN", "VERCEL_TOKEN")).toBe(false);
    expect(isAllowedTokenEnvVar("SUPABASE", "SUPABASE_SERVICE_ROLE_KEY")).toBe(false);
    expect(isAllowedTokenEnvVar("DIGITALOCEAN", "DO_API_TOKEN_")).toBe(false);
    expect(isAllowedTokenEnvVar("DIGITALOCEAN", "DO_API_TOKENX")).toBe(false);
    expect(isAllowedTokenEnvVar("DIGITALOCEAN", "do_api_token")).toBe(false);
  });
});

describe("vercelTeamEnvVar", () => {
  it("mirrors the token variable suffix", () => {
    expect(vercelTeamEnvVar("VERCEL_TOKEN")).toBe("VERCEL_TEAM_ID");
    expect(vercelTeamEnvVar("VERCEL_TOKEN_ACME")).toBe("VERCEL_TEAM_ID_ACME");
  });
});

describe("defaultHealthCheckUrl", () => {
  it("appends /health for App Platform apps", () => {
    expect(defaultHealthCheckUrl("DO_APP", "https://api.example.com/")).toBe(
      "https://api.example.com/health",
    );
  });

  it("uses the site itself for Vercel and nothing for databases/mobile", () => {
    expect(defaultHealthCheckUrl("VERCEL_PROJECT", "https://ui.example.com")).toBe(
      "https://ui.example.com",
    );
    expect(defaultHealthCheckUrl("SUPABASE_PROJECT", "https://x.supabase.co")).toBeNull();
    expect(defaultHealthCheckUrl("EXPO_APP", null)).toBeNull();
    expect(defaultHealthCheckUrl("DO_APP", null)).toBeNull();
  });
});
