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

/** The resource fields collectors need (no Prisma types, for testability). */
export type CollectorResource = {
  id: string;
  externalId: string;
  config: unknown;
};

export type CollectedSample = {
  capturedAt: Date;
  cpuPercent: number | null;
  memoryPercent: number | null;
  /** null = not applicable or not reported. */
  diskPercent: number | null;
  /** Restarts since the previous sample (a delta, not a cumulative counter). */
  restartCount: number | null;
};

export type CollectedDeployment = {
  externalId: string;
  status: "BUILDING" | "SUCCESS" | "FAILED" | "CANCELED";
  cause: string | null;
  commitSha: string | null;
  commitMessage: string | null;
  branch: string | null;
  url: string | null;
  startedAt: Date;
  finishedAt: Date | null;
};

export interface MetricsProvider {
  /** Samples captured within [from, to], oldest first. Rejects with ProviderError. */
  getMetrics(
    credential: Credential,
    resource: CollectorResource,
    from: Date,
    to: Date,
  ): Promise<CollectedSample[]>;
}

export interface DeploymentProvider {
  /** Deployments started at or after `since` (plus any still in progress), newest first. */
  listDeployments(
    credential: Credential,
    resource: CollectorResource,
    since: Date,
  ): Promise<CollectedDeployment[]>;
}

export type ResourceCollector = {
  metrics?: MetricsProvider;
  deployments?: DeploymentProvider;
};
