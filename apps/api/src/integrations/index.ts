import { type ResourceType } from "@jarvis/db";
import { type ConnectableProvider } from "@jarvis/shared";
import { createDigitalOceanDiscovery } from "./digitalocean";
import { createDigitalOceanAppCollector } from "./digitalocean-apps";
import { createExpoDiscovery } from "./expo";
import { type FetchFn } from "./http";
import { createSupabaseDiscovery } from "./supabase";
import { type DiscoveryProvider, type ResourceCollector } from "./types";
import { createVercelDiscovery } from "./vercel";

export function createDiscoveryProviders(
  fetch: FetchFn,
): Record<ConnectableProvider, DiscoveryProvider> {
  return {
    DIGITALOCEAN: createDigitalOceanDiscovery(fetch),
    SUPABASE: createSupabaseDiscovery(fetch),
    VERCEL: createVercelDiscovery(fetch),
    EXPO: createExpoDiscovery(fetch),
  };
}

/** Live collectors by Resource.type. Types without an entry are not collected yet. */
export type CollectorRegistry = Partial<Record<ResourceType, ResourceCollector>>;

export function createCollectors(fetch: FetchFn): CollectorRegistry {
  return {
    DO_APP: createDigitalOceanAppCollector(fetch),
  };
}
