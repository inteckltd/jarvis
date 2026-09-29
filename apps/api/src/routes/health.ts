import { type FastifyPluginAsync } from "fastify";

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get("/health", { config: { public: true } }, async () => ({
    status: "ok",
    service: "jarvis-api",
    time: new Date().toISOString(),
  }));
};
