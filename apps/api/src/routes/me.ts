import { type FastifyPluginAsync } from "fastify";

export const meRoutes: FastifyPluginAsync = async (app) => {
  app.get("/v1/me", async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: "Unauthorized" });
    return { sub: request.user.sub, email: request.user.email };
  });
};
