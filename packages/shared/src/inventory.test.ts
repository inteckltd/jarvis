import { describe, expect, it } from "vitest";
import {
  firstFieldErrors,
  parseRepoRef,
  providerAccountSchema,
  repositoryInputSchema,
  resourceInputSchema,
} from "./inventory";

const account = {
  provider: "DIGITALOCEAN",
  label: "Inteck DigitalOcean",
  clientId: "",
  authType: "ENV_TOKEN",
  envVarName: "do_api_token",
  token: "",
  teamId: "",
};

describe("providerAccountSchema", () => {
  it("normalises an env-token account", () => {
    const parsed = providerAccountSchema({ requireToken: true }).parse(account);
    expect(parsed).toMatchObject({ clientId: null, envVarName: "DO_API_TOKEN", token: null });
  });

  it("rejects env vars outside the provider's pattern", () => {
    const result = providerAccountSchema({ requireToken: true }).safeParse({
      ...account,
      envVarName: "ENCRYPTION_KEY",
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(firstFieldErrors(result.error)).toHaveProperty("envVarName");
  });

  it("requires a token for new encrypted accounts only", () => {
    const encrypted = { ...account, authType: "ENCRYPTED_TOKEN", envVarName: "" };
    expect(providerAccountSchema({ requireToken: true }).safeParse(encrypted).success).toBe(false);
    expect(providerAccountSchema({ requireToken: false }).safeParse(encrypted).success).toBe(true);
    expect(
      providerAccountSchema({ requireToken: true }).safeParse({ ...encrypted, token: "dop_v1_abc" })
        .success,
    ).toBe(true);
  });

  it("rejects AWS for now", () => {
    expect(
      providerAccountSchema({ requireToken: true }).safeParse({ ...account, provider: "AWS" })
        .success,
    ).toBe(false);
  });
});

const resource = {
  clientId: "c1",
  providerAccountId: "a1",
  type: "DO_APP",
  externalId: "abc-123",
  name: "workforce-api",
  environment: "PRODUCTION",
  region: "lon",
  liveUrl: "https://api.example.com/",
  healthCheckUrl: "",
  repositoryId: "",
  active: true,
  config: { componentName: " workforce-api ", unrelated: "" },
};

describe("resourceInputSchema", () => {
  it("cleans URLs, empties and config", () => {
    const parsed = resourceInputSchema.parse(resource);
    expect(parsed.liveUrl).toBe("https://api.example.com");
    expect(parsed.healthCheckUrl).toBeNull();
    expect(parsed.repositoryId).toBeNull();
    expect(parsed.config).toEqual({ componentName: "workforce-api" });
  });

  it("requires a component name for DO apps", () => {
    const result = resourceInputSchema.safeParse({ ...resource, config: {} });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(firstFieldErrors(result.error)["config.componentName"]).toBe(
        "Component name is required",
      );
    }
  });

  it("validates Vercel targets", () => {
    const vercel = { ...resource, type: "VERCEL_PROJECT", config: { target: "staging" } };
    expect(resourceInputSchema.safeParse(vercel).success).toBe(false);
    expect(
      resourceInputSchema.parse({
        ...vercel,
        config: { target: "preview", branch: "pre-production" },
      }).config,
    ).toEqual({ target: "preview", branch: "pre-production" });
  });

  it("rejects non-http URLs", () => {
    expect(
      resourceInputSchema.safeParse({ ...resource, liveUrl: "javascript:alert(1)" }).success,
    ).toBe(false);
  });
});

describe("repositoryInputSchema", () => {
  const repo = {
    owner: "industrial-door-systems",
    name: "ids.workforce-api",
    productionBranch: "main",
    developmentBranch: "pre-production",
    active: true,
  };

  it("accepts a typical repository", () => {
    expect(repositoryInputSchema.parse(repo)).toEqual(repo);
    expect(
      repositoryInputSchema.parse({ ...repo, developmentBranch: "" }).developmentBranch,
    ).toBeNull();
  });

  it("rejects invalid names and identical branches", () => {
    expect(repositoryInputSchema.safeParse({ ...repo, owner: "-bad" }).success).toBe(false);
    expect(repositoryInputSchema.safeParse({ ...repo, name: "a b" }).success).toBe(false);
    expect(repositoryInputSchema.safeParse({ ...repo, developmentBranch: "main" }).success).toBe(
      false,
    );
    expect(repositoryInputSchema.safeParse({ ...repo, productionBranch: "" }).success).toBe(false);
  });
});

describe("parseRepoRef", () => {
  it.each([
    ["industrial-door-systems/ids.workforce-api"],
    ["https://github.com/industrial-door-systems/ids.workforce-api"],
    ["https://github.com/industrial-door-systems/ids.workforce-api.git"],
    ["git@github.com:industrial-door-systems/ids.workforce-api.git"],
  ])("parses %s", (input) => {
    expect(parseRepoRef(input)).toEqual({
      owner: "industrial-door-systems",
      name: "ids.workforce-api",
    });
  });

  it("returns null for non-GitHub input", () => {
    expect(parseRepoRef("https://gitlab.com/a/b/c")).toBeNull();
    expect(parseRepoRef("just-a-name")).toBeNull();
  });
});
