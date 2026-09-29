import { describe, expect, it } from "vitest";
import { createDigitalOceanDiscovery } from "../src/integrations/digitalocean";
import { createExpoDiscovery } from "../src/integrations/expo";
import { type FetchFn, ProviderError } from "../src/integrations/http";
import { createSupabaseDiscovery } from "../src/integrations/supabase";
import { createVercelDiscovery } from "../src/integrations/vercel";

type Call = { url: string; init: RequestInit | undefined };

/** A fake fetch that answers from a queue and records requests. */
function fakeFetch(responses: Array<{ status?: number; body: unknown }>) {
  const calls: Call[] = [];
  const fn: FetchFn = async (input, init) => {
    calls.push({ url: String(input), init });
    const next = responses.shift();
    if (!next) throw new Error("unexpected request");
    return new Response(JSON.stringify(next.body), {
      status: next.status ?? 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  return { fn, calls };
}

const TOKEN = "dop_v1_super_secret_token";
const cred = { token: TOKEN, teamId: null };

describe("DigitalOcean discovery", () => {
  const app = (id: string, name: string, branch: string) => ({
    id,
    spec: {
      name,
      region: "lon",
      services: [
        { name: "api", github: { repo: "industrial-door-systems/ids.workforce-api", branch } },
      ],
      workers: [{ name: "queue" }],
    },
    live_url: `https://${name}.ondigitalocean.app`,
    region: { slug: "lon" },
    active_deployment: { phase: "ACTIVE" },
  });

  it("maps apps and follows pagination", async () => {
    const { fn, calls } = fakeFetch([
      { body: { apps: [app("1", "ids-workforce-api", "main")], links: { pages: { next: "x" } } } },
      { body: { apps: [app("2", "ids-workforce-api-dev", "pre-production")], links: {} } },
    ]);
    const items = await createDigitalOceanDiscovery(fn).listResources(cred);

    expect(calls).toHaveLength(2);
    expect(calls[1]?.url).toContain("page=2");
    expect(new Headers(calls[0]?.init?.headers).get("authorization")).toBe(`Bearer ${TOKEN}`);
    expect(items.map((i) => [i.name, i.suggestedEnvironment])).toEqual([
      ["ids-workforce-api", "PRODUCTION"],
      ["ids-workforce-api-dev", "DEVELOPMENT"],
    ]);
    expect(items[0]).toMatchObject({
      type: "DO_APP",
      externalId: "1",
      region: "lon",
      branch: "main",
      liveUrl: "https://ids-workforce-api.ondigitalocean.app",
      suggestedHealthCheckUrl: "https://ids-workforce-api.ondigitalocean.app/health",
      repository: { owner: "industrial-door-systems", name: "ids.workforce-api" },
      config: { componentName: "api" },
      components: ["api", "queue"],
      status: "ACTIVE",
    });
  });

  it("reports a rejected token without leaking it", async () => {
    const { fn } = fakeFetch([
      { status: 401, body: { id: "unauthorized", message: "Unable to authenticate you" } },
    ]);
    const error = await createDigitalOceanDiscovery(fn)
      .testConnection(cred)
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ProviderError);
    expect((error as ProviderError).message).toBe(
      "DigitalOcean rejected the token (401): Unable to authenticate you",
    );
    expect((error as ProviderError).message).not.toContain(TOKEN);
  });

  it("rejects responses that don't match the schema", async () => {
    const { fn } = fakeFetch([{ body: { apps: [{ id: 1 }] } }]);
    await expect(createDigitalOceanDiscovery(fn).listResources(cred)).rejects.toThrow(
      /Unexpected response from DigitalOcean/,
    );
  });

  it("reports network failures", async () => {
    const fn: FetchFn = async () => {
      throw new TypeError("fetch failed");
    };
    await expect(createDigitalOceanDiscovery(fn).testConnection(cred)).rejects.toThrow(
      "Could not reach DigitalOcean",
    );
  });
});

describe("Supabase discovery", () => {
  it("offers each project as a database and as edge functions", async () => {
    const { fn } = fakeFetch([
      {
        body: [
          {
            id: "abc",
            ref: "abc",
            name: "ids-simplx-dev",
            region: "eu-west-2",
            status: "ACTIVE_HEALTHY",
          },
          { ref: "xyz", name: "ids-simplx", region: "eu-west-2" },
        ],
      },
    ]);
    const items = await createSupabaseDiscovery(fn).listResources(cred);
    expect(items.map((i) => [i.type, i.externalId, i.suggestedEnvironment])).toEqual([
      ["SUPABASE_PROJECT", "xyz", "PRODUCTION"],
      ["SUPABASE_FUNCTIONS", "xyz", "PRODUCTION"],
      ["SUPABASE_PROJECT", "abc", "DEVELOPMENT"],
      ["SUPABASE_FUNCTIONS", "abc", "DEVELOPMENT"],
    ]);
    expect(items[1]?.liveUrl).toBe("https://xyz.supabase.co/functions/v1");
  });
});

describe("Vercel discovery", () => {
  it("passes the team, follows the continuation token and maps the git link", async () => {
    const project = {
      id: "prj_1",
      name: "ids-simplx-ui",
      framework: "nextjs",
      link: {
        type: "github",
        org: "industrial-door-systems",
        repo: "ids-simplx.ui",
        productionBranch: "main",
      },
      targets: { production: { alias: ["ids-simplx-ui.vercel.app"] } },
    };
    const { fn, calls } = fakeFetch([
      { body: { projects: [project], pagination: { next: 1700000000000 } } },
      {
        body: {
          projects: [{ id: "prj_2", name: "other", targets: "unexpected" }],
          pagination: { next: null },
        },
      },
    ]);
    const items = await createVercelDiscovery(fn).listResources({ token: "v", teamId: "team_1" });

    expect(calls[0]?.url).toContain("teamId=team_1");
    expect(calls[1]?.url).toContain("from=1700000000000");
    expect(items).toHaveLength(2);
    expect(items.find((i) => i.externalId === "prj_1")).toMatchObject({
      liveUrl: "https://ids-simplx-ui.vercel.app",
      suggestedHealthCheckUrl: "https://ids-simplx-ui.vercel.app",
      repository: { owner: "industrial-door-systems", name: "ids-simplx.ui" },
      config: { target: "production", branch: "main" },
    });
    expect(items.find((i) => i.externalId === "prj_2")?.liveUrl).toBeNull();
  });
});

describe("Expo discovery", () => {
  it("lists apps across accounts and tolerates partial GraphQL errors", async () => {
    const node = {
      id: "app-1",
      name: "IDS Simplx",
      slug: "ids-simplx",
      fullName: "@inteck/ids-simplx",
      githubRepository: null,
    };
    const { fn, calls } = fakeFetch([
      {
        body: {
          data: {
            meActor: {
              accounts: [
                { name: "inteck", appsPaginated: { edges: [{ node }] } },
                { name: "other", appsPaginated: { edges: [{ node }] } },
              ],
            },
          },
          errors: [{ message: "not authorised to read githubRepository" }],
        },
      },
    ]);
    const items = await createExpoDiscovery(fn).listResources(cred);
    expect(calls[0]?.init?.method).toBe("POST");
    expect(items).toEqual([
      expect.objectContaining({
        type: "EXPO_APP",
        externalId: "app-1",
        name: "IDS Simplx",
        suggestedEnvironment: "NONE",
      }),
    ]);
  });

  it("surfaces GraphQL errors when there is no data", async () => {
    const { fn } = fakeFetch([{ body: { data: null, errors: [{ message: "Unauthorized" }] } }]);
    await expect(createExpoDiscovery(fn).testConnection(cred)).rejects.toThrow(
      "Expo: Unauthorized",
    );
  });
});
