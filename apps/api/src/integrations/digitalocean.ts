import { defaultHealthCheckUrl, parseRepoRef, suggestEnvironment } from "@jarvis/shared";
import { z } from "zod";
import { type FetchFn, requestJson } from "./http";
import { type DiscoveredItem, type DiscoveryProvider } from "./types";

export const DO_API_BASE = "https://api.digitalocean.com";
const PER_PAGE = 100;
const MAX_PAGES = 20;

const gitSourceSchema = z.object({ repo: z.string().optional(), branch: z.string().optional() });

export const doComponentSchema = z.object({
  name: z.string(),
  github: gitSourceSchema.optional(),
  gitlab: gitSourceSchema.optional(),
  bitbucket: gitSourceSchema.optional(),
  git: z
    .object({ repo_clone_url: z.string().optional(), branch: z.string().optional() })
    .optional(),
});

const appSchema = z.object({
  id: z.string(),
  spec: z.object({
    name: z.string(),
    region: z.string().optional(),
    services: z.array(doComponentSchema).optional(),
    workers: z.array(doComponentSchema).optional(),
    static_sites: z.array(doComponentSchema).optional(),
  }),
  live_url: z.string().optional(),
  default_ingress: z.string().optional(),
  region: z.object({ slug: z.string() }).optional(),
  active_deployment: z.object({ phase: z.string().optional() }).optional(),
});

const listSchema = z.object({
  apps: z.array(appSchema).optional(),
  meta: z.object({ total: z.number().optional() }).optional(),
  links: z.object({ pages: z.object({ next: z.string().optional() }).optional() }).optional(),
});

type DoApp = z.infer<typeof appSchema>;

export function mapDoApp(app: DoApp): DiscoveredItem {
  const services = app.spec.services ?? [];
  const all = [...services, ...(app.spec.workers ?? []), ...(app.spec.static_sites ?? [])];
  const primary = services[0] ?? all[0];
  const source = primary?.github ?? primary?.gitlab ?? primary?.bitbucket;
  const branch = source?.branch ?? primary?.git?.branch ?? null;
  const repoRef = primary?.github?.repo ?? primary?.git?.repo_clone_url;
  const liveUrl = app.live_url ?? app.default_ingress ?? null;

  return {
    type: "DO_APP",
    externalId: app.id,
    name: app.spec.name,
    region: app.region?.slug ?? app.spec.region ?? null,
    liveUrl,
    suggestedEnvironment: suggestEnvironment({ name: app.spec.name, branch }),
    suggestedHealthCheckUrl: defaultHealthCheckUrl("DO_APP", liveUrl),
    branch,
    repository: repoRef ? parseRepoRef(repoRef) : null,
    config: primary ? { componentName: primary.name } : {},
    components: all.map((c) => c.name),
    status: app.active_deployment?.phase ?? null,
  };
}

export function createDigitalOceanDiscovery(fetch: FetchFn): DiscoveryProvider {
  const get = (path: string, token: string) =>
    requestJson({
      fetch,
      provider: "DigitalOcean",
      url: `${DO_API_BASE}${path}`,
      token,
      schema: listSchema,
    });

  return {
    provider: "DIGITALOCEAN",

    async testConnection({ token }) {
      const page = await get("/v2/apps?per_page=1", token);
      const total = page.meta?.total ?? page.apps?.length ?? 0;
      return `Connected · ${total} App Platform app${total === 1 ? "" : "s"} visible`;
    },

    async listResources({ token }) {
      const apps: DoApp[] = [];
      for (let page = 1; page <= MAX_PAGES; page++) {
        const res = await get(`/v2/apps?page=${page}&per_page=${PER_PAGE}`, token);
        apps.push(...(res.apps ?? []));
        if (!res.links?.pages?.next || (res.apps?.length ?? 0) === 0) break;
      }
      return apps.map(mapDoApp).sort((a, b) => a.name.localeCompare(b.name));
    },
  };
}
