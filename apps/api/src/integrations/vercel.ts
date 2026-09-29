import { defaultHealthCheckUrl, suggestEnvironment } from "@jarvis/shared";
import { z } from "zod";
import { type Credential } from "./credentials";
import { type FetchFn, requestJson } from "./http";
import { type DiscoveredItem, type DiscoveryProvider } from "./types";

const BASE = "https://api.vercel.com";
const MAX_PAGES = 20;

const projectSchema = z.object({
  id: z.string(),
  name: z.string(),
  framework: z.string().nullish(),
  serverlessFunctionRegion: z.string().nullish(),
  link: z
    .object({
      type: z.string().optional(),
      org: z.string().optional(),
      repo: z.string().optional(),
      productionBranch: z.string().optional(),
    })
    .nullish(),
  // Loosely typed in Vercel's docs; only the production aliases are used.
  targets: z
    .object({
      production: z.object({ alias: z.array(z.string()).optional() }).nullish(),
    })
    .nullish()
    .catch(null),
});

const listSchema = z.object({
  projects: z.array(projectSchema),
  pagination: z.object({ next: z.union([z.number(), z.string()]).nullish() }).optional(),
});

type VercelProject = z.infer<typeof projectSchema>;

export function mapVercelProject(project: VercelProject): DiscoveredItem {
  const alias = project.targets?.production?.alias?.[0];
  const liveUrl = alias ? `https://${alias.replace(/^https?:\/\//, "")}` : null;
  const branch = project.link?.productionBranch ?? null;
  const repository =
    project.link?.type === "github" && project.link.org && project.link.repo
      ? { owner: project.link.org, name: project.link.repo }
      : null;
  return {
    type: "VERCEL_PROJECT",
    externalId: project.id,
    name: project.name,
    region: project.serverlessFunctionRegion ?? null,
    liveUrl,
    suggestedEnvironment: suggestEnvironment({ name: project.name }),
    suggestedHealthCheckUrl: defaultHealthCheckUrl("VERCEL_PROJECT", liveUrl),
    branch,
    repository,
    config: { target: "production", branch: branch ?? "main" },
    components: [],
    status: project.framework ?? null,
  };
}

function projectsUrl({ teamId }: Credential, extra: Record<string, string>): URL {
  const url = new URL(`${BASE}/v10/projects`);
  if (teamId) url.searchParams.set("teamId", teamId);
  for (const [k, v] of Object.entries(extra)) url.searchParams.set(k, v);
  return url;
}

export function createVercelDiscovery(fetch: FetchFn): DiscoveryProvider {
  const get = (credential: Credential, extra: Record<string, string>) =>
    requestJson({
      fetch,
      provider: "Vercel",
      url: projectsUrl(credential, extra),
      token: credential.token,
      schema: listSchema,
    });

  return {
    provider: "VERCEL",

    async testConnection(credential) {
      await get(credential, { limit: "1" });
      return credential.teamId
        ? `Connected · team ${credential.teamId}`
        : "Connected · personal account";
    },

    async listResources(credential) {
      const projects: VercelProject[] = [];
      let from: string | null = null;
      for (let page = 0; page < MAX_PAGES; page++) {
        const res = await get(credential, { limit: "100", ...(from ? { from } : {}) });
        projects.push(...res.projects);
        const next = res.pagination?.next;
        if (next === null || next === undefined || res.projects.length === 0) break;
        from = String(next);
      }
      return projects.map(mapVercelProject).sort((a, b) => a.name.localeCompare(b.name));
    },
  };
}
