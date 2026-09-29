import { type Prisma, type PrismaClient } from "@jarvis/db";
import {
  type ConnectableProvider,
  type CredentialStatusList,
  type DiscoveredResource,
  firstFieldErrors,
  isConnectableProvider,
  providerAccountSchema,
} from "@jarvis/shared";
import { type FastifyPluginAsync, type FastifyReply } from "fastify";
import { z } from "zod";
import {
  CredentialError,
  maskToken,
  resolveCredential,
  serializeCredential,
} from "../integrations/credentials";
import { ProviderError } from "../integrations/http";
import { type DiscoveryProvider } from "../integrations/types";
import { type SecretBox } from "../lib/crypto";

export type ProviderAccountDeps = {
  db: PrismaClient;
  env: NodeJS.ProcessEnv;
  box: SecretBox | null;
  discovery: Record<ConnectableProvider, DiscoveryProvider>;
};

const idParams = z.object({ id: z.string().min(1).max(64) });

const badRequest = (
  reply: FastifyReply,
  message: string,
  fieldErrors: Record<string, string> = {},
) => reply.code(400).send({ error: "Bad Request", message, fieldErrors });

const notFound = (reply: FastifyReply) =>
  reply.code(404).send({ error: "Not Found", message: "Provider account not found" });

/** Safe, user-facing text for anything thrown while talking to a provider. */
function describeFailure(error: unknown): string | null {
  if (error instanceof CredentialError || error instanceof ProviderError) return error.message;
  return null;
}

export const providerAccountRoutes =
  (deps: ProviderAccountDeps): FastifyPluginAsync =>
  async (app) => {
    const { db, env, box, discovery } = deps;

    async function clientExists(clientId: string | null): Promise<boolean> {
      if (!clientId) return true;
      return (await db.client.count({ where: { id: clientId } })) > 0;
    }

    app.get("/v1/provider-accounts/credentials", async (): Promise<CredentialStatusList> => {
      const accounts = await db.providerAccount.findMany({
        select: {
          id: true,
          provider: true,
          authType: true,
          envVarName: true,
          encryptedCredentials: true,
        },
      });
      return {
        accounts: accounts.map((account) => {
          try {
            const credential = resolveCredential(account, { env, box });
            return {
              id: account.id,
              status: "ok",
              masked: maskToken(credential.token),
              detail: null,
            };
          } catch (error) {
            if (error instanceof CredentialError) {
              return { id: account.id, status: error.status, masked: null, detail: error.message };
            }
            throw error;
          }
        }),
      };
    });

    app.post("/v1/provider-accounts", async (request, reply) => {
      const parsed = providerAccountSchema({ requireToken: true }).safeParse(request.body);
      if (!parsed.success)
        return badRequest(reply, "Invalid input", firstFieldErrors(parsed.error));
      const input = parsed.data;

      if (!(await clientExists(input.clientId))) {
        return badRequest(reply, "Client not found", { clientId: "Client not found" });
      }
      if (input.authType === "ENCRYPTED_TOKEN" && !box) {
        return badRequest(
          reply,
          "ENCRYPTION_KEY is not configured on the API, so tokens cannot be stored",
        );
      }

      const created = await db.providerAccount.create({
        data: {
          provider: input.provider,
          label: input.label,
          clientId: input.clientId,
          authType: input.authType,
          envVarName: input.authType === "ENV_TOKEN" ? input.envVarName : null,
          encryptedCredentials:
            input.authType === "ENCRYPTED_TOKEN" && box && input.token
              ? serializeCredential(box, {
                  token: input.token,
                  teamId: input.provider === "VERCEL" ? input.teamId : null,
                })
              : null,
        },
        select: { id: true },
      });
      return reply.code(201).send(created);
    });

    app.patch("/v1/provider-accounts/:id", async (request, reply) => {
      const params = idParams.safeParse(request.params);
      if (!params.success) return notFound(reply);
      const existing = await db.providerAccount.findUnique({ where: { id: params.data.id } });
      if (!existing || !isConnectableProvider(existing.provider)) return notFound(reply);

      // The provider of an existing account never changes.
      const body = typeof request.body === "object" && request.body ? request.body : {};
      const parsed = providerAccountSchema({ requireToken: false }).safeParse({
        ...body,
        provider: existing.provider,
      });
      if (!parsed.success)
        return badRequest(reply, "Invalid input", firstFieldErrors(parsed.error));
      const input = parsed.data;

      if (!(await clientExists(input.clientId))) {
        return badRequest(reply, "Client not found", { clientId: "Client not found" });
      }

      const data: Prisma.ProviderAccountUpdateInput = {
        label: input.label,
        client: input.clientId ? { connect: { id: input.clientId } } : { disconnect: true },
        authType: input.authType,
      };
      let credentialsChanged = input.authType !== existing.authType;

      if (input.authType === "ENV_TOKEN") {
        data.envVarName = input.envVarName;
        data.encryptedCredentials = null;
        credentialsChanged ||= input.envVarName !== existing.envVarName;
      } else {
        data.envVarName = null;
        if (input.token) {
          if (!box) {
            return badRequest(
              reply,
              "ENCRYPTION_KEY is not configured on the API, so tokens cannot be stored",
            );
          }
          data.encryptedCredentials = serializeCredential(box, {
            token: input.token,
            teamId: existing.provider === "VERCEL" ? input.teamId : null,
          });
          credentialsChanged = true;
        } else if (!existing.encryptedCredentials) {
          return badRequest(reply, "Invalid input", { token: "Paste the API token" });
        }
      }

      if (credentialsChanged) {
        data.lastVerifiedAt = null;
        data.lastError = null;
      }

      await db.providerAccount.update({ where: { id: existing.id }, data });
      return { id: existing.id };
    });

    app.delete("/v1/provider-accounts/:id", async (request, reply) => {
      const params = idParams.safeParse(request.params);
      if (!params.success) return notFound(reply);
      const account = await db.providerAccount.findUnique({
        where: { id: params.data.id },
        select: { id: true, _count: { select: { resources: true } } },
      });
      if (!account) return notFound(reply);
      if (account._count.resources > 0) {
        const n = account._count.resources;
        return reply.code(409).send({
          error: "Conflict",
          message: `Remove its ${n} resource${n === 1 ? "" : "s"} before deleting this account`,
        });
      }
      await db.providerAccount.delete({ where: { id: account.id } });
      return reply.code(204).send();
    });

    app.post("/v1/provider-accounts/:id/test", async (request, reply) => {
      const params = idParams.safeParse(request.params);
      if (!params.success) return notFound(reply);
      const account = await db.providerAccount.findUnique({ where: { id: params.data.id } });
      if (!account) return notFound(reply);

      try {
        if (!isConnectableProvider(account.provider)) {
          throw new CredentialError("unsupported", `${account.provider} is not supported yet`);
        }
        const credential = resolveCredential(account, { env, box });
        const message = await discovery[account.provider].testConnection(credential);
        const verifiedAt = new Date();
        await db.providerAccount.update({
          where: { id: account.id },
          data: { lastVerifiedAt: verifiedAt, lastError: null },
        });
        return { ok: true, message, verifiedAt: verifiedAt.toISOString() };
      } catch (error) {
        const message = describeFailure(error);
        if (message === null) throw error;
        request.log.warn({ accountId: account.id, reason: message }, "connection test failed");
        await db.providerAccount.update({
          where: { id: account.id },
          data: { lastError: message },
        });
        return { ok: false, message, verifiedAt: account.lastVerifiedAt?.toISOString() ?? null };
      }
    });

    app.get("/v1/provider-accounts/:id/discover", async (request, reply) => {
      const params = idParams.safeParse(request.params);
      if (!params.success) return notFound(reply);
      const account = await db.providerAccount.findUnique({ where: { id: params.data.id } });
      if (!account) return notFound(reply);

      let items;
      try {
        if (!isConnectableProvider(account.provider)) {
          throw new CredentialError("unsupported", `${account.provider} is not supported yet`);
        }
        const credential = resolveCredential(account, { env, box });
        items = await discovery[account.provider].listResources(credential);
      } catch (error) {
        const message = describeFailure(error);
        if (message === null) throw error;
        request.log.warn({ accountId: account.id, reason: message }, "discovery failed");
        await db.providerAccount.update({
          where: { id: account.id },
          data: { lastError: message },
        });
        return reply.code(502).send({ error: "Bad Gateway", message });
      }

      await db.providerAccount.update({
        where: { id: account.id },
        data: { lastVerifiedAt: new Date(), lastError: null },
      });

      const existing = await db.resource.findMany({
        where: { providerAccountId: account.id },
        select: {
          id: true,
          type: true,
          externalId: true,
          environment: true,
          client: { select: { name: true, slug: true } },
        },
      });
      const key = (type: string, externalId: string) => `${type}:${externalId}`;
      const imported = new Map<string, DiscoveredResource["imported"]>();
      for (const r of existing) {
        const list = imported.get(key(r.type, r.externalId)) ?? [];
        list.push({
          resourceId: r.id,
          environment: r.environment,
          clientName: r.client.name,
          clientSlug: r.client.slug,
        });
        imported.set(key(r.type, r.externalId), list);
      }

      return {
        items: items.map((item) => ({
          ...item,
          imported: imported.get(key(item.type, item.externalId)) ?? [],
        })),
      };
    });
  };
