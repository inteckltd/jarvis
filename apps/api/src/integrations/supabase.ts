import { suggestEnvironment } from "@jarvis/shared";
import { z } from "zod";
import { type FetchFn, requestJson } from "./http";
import { type DiscoveredItem, type DiscoveryProvider } from "./types";

const BASE = "https://api.supabase.com";

const projectSchema = z
  .object({
    id: z.string().optional(),
    ref: z.string().optional(),
    name: z.string(),
    region: z.string().optional(),
    status: z.string().optional(),
  })
  .refine((p) => Boolean(p.ref ?? p.id), "project has no ref");

const listSchema = z.array(projectSchema);

type SupabaseProject = z.infer<typeof projectSchema>;

/** Each project can be imported twice: the database and its edge functions. */
export function mapSupabaseProject(project: SupabaseProject): DiscoveredItem[] {
  const ref = project.ref ?? project.id ?? "";
  const shared = {
    externalId: ref,
    region: project.region ?? null,
    suggestedEnvironment: suggestEnvironment({ name: project.name }),
    suggestedHealthCheckUrl: null,
    branch: null,
    repository: null,
    config: {},
    components: [],
    status: project.status ?? null,
  } satisfies Omit<DiscoveredItem, "type" | "name" | "liveUrl">;
  const base = `https://${ref}.supabase.co`;
  return [
    { ...shared, type: "SUPABASE_PROJECT", name: project.name, liveUrl: base },
    {
      ...shared,
      type: "SUPABASE_FUNCTIONS",
      name: `${project.name} functions`,
      liveUrl: `${base}/functions/v1`,
    },
  ];
}

export function createSupabaseDiscovery(fetch: FetchFn): DiscoveryProvider {
  const list = (token: string) =>
    requestJson({
      fetch,
      provider: "Supabase",
      url: `${BASE}/v1/projects`,
      token,
      schema: listSchema,
    });

  return {
    provider: "SUPABASE",

    async testConnection({ token }) {
      const projects = await list(token);
      return `Connected · ${projects.length} project${projects.length === 1 ? "" : "s"} visible`;
    },

    async listResources({ token }) {
      const projects = await list(token);
      return projects.sort((a, b) => a.name.localeCompare(b.name)).flatMap(mapSupabaseProject);
    },
  };
}
