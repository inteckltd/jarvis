import { type ConnectableProvider, type DiscoveredResource } from "@jarvis/shared";
import { type Credential } from "./credentials";

/** What an adapter returns; apps/api adds the "imported" state from the database. */
export type DiscoveredItem = Omit<DiscoveredResource, "imported">;

export interface DiscoveryProvider {
  readonly provider: ConnectableProvider;
  /** Resolves with a short human-readable summary, rejects with ProviderError. */
  testConnection(credential: Credential): Promise<string>;
  listResources(credential: Credential): Promise<DiscoveredItem[]>;
}
