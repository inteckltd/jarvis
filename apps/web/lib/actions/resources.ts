"use server";

import { Prisma, prisma } from "@jarvis/db";
import {
  firstFieldErrors,
  RESOURCE_CONFIG_FIELDS,
  RESOURCE_TYPE_PROVIDER,
  resourceInputSchema,
} from "@jarvis/shared";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { ENVIRONMENT_LABEL } from "@/lib/labels";

export type ResourceFormState =
  | { status: "idle" }
  | { status: "error"; message: string | null; fieldErrors: Record<string, string> }
  | { status: "saved"; resourceId: string; name: string; clientName: string; clientSlug: string };

type Identity = { providerAccountId: string; type: string; externalId: string };

function readResourceForm(formData: FormData) {
  const text = (key: string) => {
    const v = formData.get(key);
    return typeof v === "string" ? v : "";
  };
  const config: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("config.") && typeof value === "string") config[key.slice(7)] = value;
  }
  return {
    clientId: text("clientId"),
    providerAccountId: text("providerAccountId"),
    type: text("type"),
    externalId: text("externalId"),
    name: text("name"),
    environment: text("environment"),
    region: text("region"),
    liveUrl: text("liveUrl"),
    healthCheckUrl: text("healthCheckUrl"),
    repositoryId: text("repositoryId"),
    active: formData.get("active") === "on",
    config,
  };
}

const fail = (
  fieldErrors: Record<string, string>,
  message: string | null = null,
): ResourceFormState => ({
  status: "error",
  message,
  fieldErrors,
});

function isPrismaError(error: unknown, code: string): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

async function saveResource(
  resourceId: string | null,
  after: "redirect" | "stay",
  formData: FormData,
): Promise<ResourceFormState> {
  await requireUser();

  const existing = resourceId
    ? await prisma.resource.findUnique({
        where: { id: resourceId },
        select: { providerAccountId: true, type: true, externalId: true, config: true },
      })
    : null;
  if (resourceId && !existing) return fail({}, "This resource no longer exists.");

  const raw = readResourceForm(formData);
  // Provider identity is fixed once a resource exists.
  const identity: Identity = existing ?? raw;
  const parsed = resourceInputSchema.safeParse({ ...raw, ...identity });
  if (!parsed.success) return fail(firstFieldErrors(parsed.error));
  const input = parsed.data;

  const [client, account, repository] = await Promise.all([
    prisma.client.findUnique({
      where: { id: input.clientId },
      select: { id: true, name: true, slug: true },
    }),
    prisma.providerAccount.findUnique({
      where: { id: input.providerAccountId },
      select: { id: true, provider: true, clientId: true },
    }),
    input.repositoryId
      ? prisma.repository.findFirst({
          where: { id: input.repositoryId, clientId: input.clientId },
          select: { id: true },
        })
      : Promise.resolve(null),
  ]);

  if (!client) return fail({ clientId: "Client not found" });
  if (!account) return fail({ providerAccountId: "Provider account not found" });
  if (account.provider !== RESOURCE_TYPE_PROVIDER[input.type]) {
    return fail({ type: "This type doesn't belong to the selected account's provider" });
  }
  if (account.clientId && account.clientId !== client.id) {
    return fail({ clientId: "This provider account belongs to a different client" });
  }
  if (input.repositoryId && !repository) {
    return fail({ repositoryId: "Pick one of this client's repositories" });
  }

  // Keep config keys the form doesn't edit (e.g. a Supabase plan); replace the ones it does.
  const editable = new Set(RESOURCE_CONFIG_FIELDS[input.type]);
  const previous =
    existing?.config && typeof existing.config === "object" && !Array.isArray(existing.config)
      ? (existing.config as Record<string, Prisma.JsonValue>)
      : {};
  const config: Prisma.InputJsonObject = {
    ...Object.fromEntries(Object.entries(previous).filter(([k]) => !editable.has(k))),
    ...input.config,
  };

  const data = {
    clientId: client.id,
    name: input.name,
    environment: input.environment,
    region: input.region,
    liveUrl: input.liveUrl,
    healthCheckUrl: input.healthCheckUrl,
    repositoryId: input.repositoryId,
    active: input.active,
    config,
  };

  let saved: { id: string };
  try {
    saved = resourceId
      ? await prisma.resource.update({ where: { id: resourceId }, data, select: { id: true } })
      : await prisma.resource.create({
          data: {
            ...data,
            providerAccountId: account.id,
            type: input.type,
            externalId: input.externalId,
          },
          select: { id: true },
        });
  } catch (error) {
    if (isPrismaError(error, "P2002")) {
      return fail({
        environment: `Already imported as ${ENVIRONMENT_LABEL[input.environment].toLowerCase()}`,
      });
    }
    if (isPrismaError(error, "P2025")) return fail({}, "This resource no longer exists.");
    console.error("Saving resource failed", error);
    return fail({}, "Could not save the resource. Please try again.");
  }

  revalidatePath("/clients", "layout");
  revalidatePath("/settings/accounts", "layout");
  revalidatePath("/");

  if (after === "redirect") redirect(`/clients/${client.slug}`);
  return {
    status: "saved",
    resourceId: saved.id,
    name: input.name,
    clientName: client.name,
    clientSlug: client.slug,
  };
}

export async function importResourceAction(
  _prev: ResourceFormState,
  formData: FormData,
): Promise<ResourceFormState> {
  return saveResource(null, "stay", formData);
}

export async function createResourceAction(
  _prev: ResourceFormState,
  formData: FormData,
): Promise<ResourceFormState> {
  return saveResource(null, "redirect", formData);
}

export async function updateResourceAction(
  resourceId: string,
  _prev: ResourceFormState,
  formData: FormData,
): Promise<ResourceFormState> {
  return saveResource(resourceId, "redirect", formData);
}

export async function deleteResourceAction(
  resourceId: string,
): Promise<{ error: string } | undefined> {
  await requireUser();
  let clientSlug: string;
  try {
    const deleted = await prisma.resource.delete({
      where: { id: resourceId },
      select: { client: { select: { slug: true } } },
    });
    clientSlug = deleted.client.slug;
  } catch (error) {
    if (isPrismaError(error, "P2025")) return { error: "This resource no longer exists." };
    throw error;
  }
  revalidatePath("/clients", "layout");
  revalidatePath("/settings/accounts", "layout");
  revalidatePath("/");
  redirect(`/clients/${clientSlug}`);
}
