import Fastify, { type FastifyServerOptions } from "fastify";
import { type JwtVerifier } from "./lib/jwt";
import { authPlugin } from "./plugins/auth";
import { healthRoutes } from "./routes/health";
import { meRoutes } from "./routes/me";

export type ServerDeps = {
  verify: JwtVerifier;
  logger?: FastifyServerOptions["logger"];
};

export async function buildServer({ verify, logger = false }: ServerDeps) {
  const app = Fastify({ logger, disableRequestLogging: false });

  await app.register(authPlugin, { verify });
  await app.register(healthRoutes);
  await app.register(meRoutes);

  return app;
}
