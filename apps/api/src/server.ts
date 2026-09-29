import { prisma } from "@jarvis/db";
import Fastify, { type FastifyServerOptions } from "fastify";
import { createDiscoveryProviders } from "./integrations";
import { type JwtVerifier } from "./lib/jwt";
import { authPlugin } from "./plugins/auth";
import { healthRoutes } from "./routes/health";
import { meRoutes } from "./routes/me";
import { type ProviderAccountDeps, providerAccountRoutes } from "./routes/provider-accounts";

export type ServerDeps = {
  verify: JwtVerifier;
  logger?: FastifyServerOptions["logger"];
  /** Overrides for tests; defaults use the real database, process.env and fetch. */
  integrations?: Partial<ProviderAccountDeps>;
};

export async function buildServer({ verify, logger = false, integrations = {} }: ServerDeps) {
  const app = Fastify({ logger });

  await app.register(authPlugin, { verify });
  await app.register(healthRoutes);
  await app.register(meRoutes);
  await app.register(
    providerAccountRoutes({
      db: integrations.db ?? prisma,
      env: integrations.env ?? process.env,
      box: integrations.box ?? null,
      discovery: integrations.discovery ?? createDiscoveryProviders(globalThis.fetch),
    }),
  );

  return app;
}
