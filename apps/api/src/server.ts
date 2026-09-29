import { prisma } from "@jarvis/db";
import Fastify, { type FastifyServerOptions } from "fastify";
import { createSyncService, type SyncService } from "./collect/sync";
import { type CollectorRegistry, createCollectors, createDiscoveryProviders } from "./integrations";
import { type JwtVerifier } from "./lib/jwt";
import { authPlugin } from "./plugins/auth";
import { healthRoutes } from "./routes/health";
import { meRoutes } from "./routes/me";
import { type ProviderAccountDeps, providerAccountRoutes } from "./routes/provider-accounts";
import { resourceRoutes } from "./routes/resources";

export type ServerDeps = {
  verify: JwtVerifier;
  logger?: FastifyServerOptions["logger"];
  /** Overrides for tests; defaults use the real database, process.env and fetch. */
  integrations?: Partial<ProviderAccountDeps> & { collectors?: CollectorRegistry };
};

export async function buildServer({ verify, logger = false, integrations = {} }: ServerDeps) {
  const app = Fastify({ logger });
  const db = integrations.db ?? prisma;
  const env = integrations.env ?? process.env;
  const box = integrations.box ?? null;

  const sync: SyncService = createSyncService({
    db,
    env,
    box,
    collectors: integrations.collectors ?? createCollectors(globalThis.fetch),
    log: app.log,
  });

  await app.register(authPlugin, { verify });
  await app.register(healthRoutes);
  await app.register(meRoutes);
  await app.register(
    providerAccountRoutes({
      db,
      env,
      box,
      discovery: integrations.discovery ?? createDiscoveryProviders(globalThis.fetch),
    }),
  );
  await app.register(resourceRoutes({ sync }));

  app.decorate("sync", sync);
  return app;
}

declare module "fastify" {
  interface FastifyInstance {
    sync: SyncService;
  }
}
