import { type ConnectableProvider } from "@jarvis/shared";
import { createDigitalOceanDiscovery } from "./digitalocean";
import { createExpoDiscovery } from "./expo";
import { type FetchFn } from "./http";
import { createSupabaseDiscovery } from "./supabase";
import { type DiscoveryProvider } from "./types";
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
