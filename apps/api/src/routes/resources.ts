import { type FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { type SyncService } from "../collect/sync";

const idParams = z.object({ id: z.string().min(1).max(64) });

export const resourceRoutes =
  ({ sync }: { sync: SyncService }): FastifyPluginAsync =>
  async (app) => {
    /** Collect metrics and deployments for one resource now (the "Sync now" button). */
    app.post("/v1/resources/:id/sync", async (request, reply) => {
      const params = idParams.safeParse(request.params);
      const notFound = { error: "Not Found", message: "Resource not found" };
      if (!params.success) return reply.code(404).send(notFound);
      const result = await sync.syncById(params.data.id);
      if (!result) return reply.code(404).send(notFound);
      return result;
    });
  };
