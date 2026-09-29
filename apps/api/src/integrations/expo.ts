import { z } from "zod";
import { type FetchFn, ProviderError, requestJson } from "./http";
import { type DiscoveredItem, type DiscoveryProvider } from "./types";

const ENDPOINT = "https://api.expo.dev/graphql";

const graphqlResponse = <T>(data: z.ZodType<T>) =>
  z.object({
    data: data.nullish(),
    errors: z.array(z.object({ message: z.string() })).optional(),
  });

const ME_QUERY = /* GraphQL */ `
  query JarvisExpoMe {
    meActor {
      __typename
      accounts {
        name
      }
    }
  }
`;

const APPS_QUERY = /* GraphQL */ `
  query JarvisExpoApps {
    meActor {
      accounts {
        name
        appsPaginated(first: 100) {
          edges {
            node {
              id
              name
              slug
              fullName
              githubRepository {
                metadata {
                  githubRepoOwnerName
                  githubRepoName
                  defaultBranch
                }
              }
            }
          }
        }
      }
    }
  }
`;

const meSchema = z.object({
  meActor: z
    .object({ __typename: z.string(), accounts: z.array(z.object({ name: z.string() })) })
    .nullable(),
});

const appNodeSchema = z.object({
  id: z.string(),
  name: z.string().nullish(),
  slug: z.string(),
  fullName: z.string(),
  githubRepository: z
    .object({
      metadata: z.object({
        githubRepoOwnerName: z.string(),
        githubRepoName: z.string(),
        defaultBranch: z.string().nullish(),
      }),
    })
    .nullish(),
});

const appsSchema = z.object({
  meActor: z
    .object({
      accounts: z.array(
        z.object({
          name: z.string(),
          appsPaginated: z.object({ edges: z.array(z.object({ node: appNodeSchema })) }),
        }),
      ),
    })
    .nullable(),
});

type ExpoApp = z.infer<typeof appNodeSchema>;

export function mapExpoApp(app: ExpoApp): DiscoveredItem {
  const repo = app.githubRepository?.metadata;
  return {
    type: "EXPO_APP",
    externalId: app.id,
    name: app.name?.trim() || app.slug,
    region: null,
    liveUrl: null,
    suggestedEnvironment: "NONE",
    suggestedHealthCheckUrl: null,
    branch: repo?.defaultBranch ?? null,
    repository: repo ? { owner: repo.githubRepoOwnerName, name: repo.githubRepoName } : null,
    config: {},
    components: [],
    status: app.fullName,
  };
}

export function createExpoDiscovery(fetch: FetchFn): DiscoveryProvider {
  async function query<T>(token: string, text: string, dataSchema: z.ZodType<T>): Promise<T> {
    const res = await requestJson({
      fetch,
      provider: "Expo",
      url: ENDPOINT,
      token,
      schema: graphqlResponse(dataSchema),
      init: {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: text }),
      },
    });
    // Partial data (e.g. a GitHub link we can't see) is fine; only fail when nothing came back.
    if (res.data === null || res.data === undefined) {
      throw new ProviderError(`Expo: ${res.errors?.[0]?.message ?? "empty GraphQL response"}`);
    }
    return res.data;
  }

  return {
    provider: "EXPO",

    async testConnection({ token }) {
      const data = await query(token, ME_QUERY, meSchema);
      if (!data.meActor) throw new ProviderError("Expo did not recognise the token");
      const names = data.meActor.accounts.map((a) => a.name).join(", ");
      return `Connected · ${data.meActor.__typename.toLowerCase()} with access to ${names || "no accounts"}`;
    },

    async listResources({ token }) {
      const data = await query(token, APPS_QUERY, appsSchema);
      if (!data.meActor) throw new ProviderError("Expo did not recognise the token");
      const seen = new Set<string>();
      const items: DiscoveredItem[] = [];
      for (const account of data.meActor.accounts) {
        for (const { node } of account.appsPaginated.edges) {
          if (seen.has(node.id)) continue;
          seen.add(node.id);
          items.push(mapExpoApp(node));
        }
      }
      return items.sort((a, b) => a.name.localeCompare(b.name));
    },
  };
}
