import fp from "fastify-plugin";
import { AuthError, AuthUnavailableError, type JwtVerifier, type VerifiedUser } from "../lib/jwt";

declare module "fastify" {
  interface FastifyContextConfig {
    /** Skip JWT verification for this route. */
    public?: boolean;
  }
  interface FastifyRequest {
    user: VerifiedUser | null;
  }
}

export const authPlugin = fp<{ verify: JwtVerifier }>(
  async (app, { verify }) => {
    app.decorateRequest("user", null);

    app.addHook("onRequest", async (request, reply) => {
      if (request.routeOptions.config.public === true) return;

      const header = request.headers.authorization;
      const match = header ? /^Bearer\s+(.+)$/i.exec(header) : null;
      const token = match?.[1];
      if (!token) {
        return reply.code(401).send({ error: "Unauthorized", message: "Missing bearer token" });
      }

      try {
        request.user = await verify(token);
      } catch (error) {
        if (error instanceof AuthError) {
          request.log.info({ reason: error.message }, "rejected request");
          return reply.code(401).send({ error: "Unauthorized", message: "Invalid token" });
        }
        if (error instanceof AuthUnavailableError) {
          request.log.error({ err: error.cause }, "auth provider unavailable");
          return reply
            .code(503)
            .send({ error: "Service Unavailable", message: "Unable to verify token" });
        }
        throw error;
      }
    });
  },
  { name: "jarvis-auth" },
);
