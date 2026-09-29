"use server";

import { Prisma, prisma } from "@jarvis/db";
import { firstFieldErrors, repositoryInputSchema } from "@jarvis/shared";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";

export type RepositoryFormState =
  | { status: "idle" }
  | { status: "error"; message: string | null; fieldErrors: Record<string, string> };

function readRepositoryForm(formData: FormData) {
  const text = (key: string) => {
    const v = formData.get(key);
    return typeof v === "string" ? v : "";
  };
  return {
    owner: text("owner"),
    name: text("name"),
    productionBranch: text("productionBranch"),
    developmentBranch: text("developmentBranch"),
    active: formData.get("active") === "on",
  };
}

function isPrismaError(error: unknown, code: string): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

function revalidate() {
  revalidatePath("/clients", "layout");
  revalidatePath("/settings/accounts", "layout");
  revalidatePath("/");
}

async function saveRepository(
  target: { clientId: string } | { repositoryId: string },
  formData: FormData,
): Promise<RepositoryFormState> {
  await requireUser();

  const parsed = repositoryInputSchema.safeParse(readRepositoryForm(formData));
  if (!parsed.success) {
    return { status: "error", message: null, fieldErrors: firstFieldErrors(parsed.error) };
  }

  let clientSlug: string;
  try {
    const saved =
      "clientId" in target
        ? await prisma.repository.create({
            data: { ...parsed.data, clientId: target.clientId },
            select: { client: { select: { slug: true } } },
          })
        : await prisma.repository.update({
            where: { id: target.repositoryId },
            data: parsed.data,
            select: { client: { select: { slug: true } } },
          });
    clientSlug = saved.client.slug;
  } catch (error) {
    if (isPrismaError(error, "P2002")) {
      const other = await prisma.repository.findUnique({
        where: { owner_name: { owner: parsed.data.owner, name: parsed.data.name } },
        select: { client: { select: { name: true } } },
      });
      return {
        status: "error",
        message: null,
        fieldErrors: { name: `Already linked${other ? ` to ${other.client.name}` : ""}` },
      };
    }
    if (isPrismaError(error, "P2025") || isPrismaError(error, "P2003")) {
      return {
        status: "error",
        message: "This client or repository no longer exists.",
        fieldErrors: {},
      };
    }
    console.error("Saving repository failed", error);
    return {
      status: "error",
      message: "Could not save the repository. Please try again.",
      fieldErrors: {},
    };
  }

  revalidate();
  redirect(`/clients/${clientSlug}`);
}

export async function createRepositoryAction(
  clientId: string,
  _prev: RepositoryFormState,
  formData: FormData,
): Promise<RepositoryFormState> {
  return saveRepository({ clientId }, formData);
}

export async function updateRepositoryAction(
  repositoryId: string,
  _prev: RepositoryFormState,
  formData: FormData,
): Promise<RepositoryFormState> {
  return saveRepository({ repositoryId }, formData);
}

export async function deleteRepositoryAction(
  repositoryId: string,
): Promise<{ error: string } | undefined> {
  await requireUser();
  let clientSlug: string;
  try {
    // Linked resources keep existing; their repositoryId is set to null by the schema.
    const deleted = await prisma.repository.delete({
      where: { id: repositoryId },
      select: { client: { select: { slug: true } } },
    });
    clientSlug = deleted.client.slug;
  } catch (error) {
    if (isPrismaError(error, "P2025")) return { error: "This repository no longer exists." };
    throw error;
  }
  revalidate();
  redirect(`/clients/${clientSlug}`);
}
