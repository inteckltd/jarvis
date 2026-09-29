"use server";

import { Prisma, prisma } from "@jarvis/db";
import { type ClientField, clientInputSchema } from "@jarvis/shared";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";

export type ClientFormState =
  | { status: "idle" }
  | { status: "error"; message: string | null; fieldErrors: Partial<Record<ClientField, string>> };

function readForm(formData: FormData) {
  const text = (key: string) => {
    const v = formData.get(key);
    return typeof v === "string" ? v : "";
  };
  return {
    name: text("name"),
    slug: text("slug"),
    logoUrl: text("logoUrl"),
    contactName: text("contactName"),
    contactEmail: text("contactEmail"),
    notes: text("notes"),
    active: formData.get("active") === "on",
  };
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

async function saveClient(clientId: string | null, formData: FormData): Promise<ClientFormState> {
  await requireUser();

  const parsed = clientInputSchema.safeParse(readForm(formData));
  if (!parsed.success) {
    const fieldErrors: Partial<Record<ClientField, string>> = {};
    for (const [field, messages] of Object.entries(z.flattenError(parsed.error).fieldErrors)) {
      const first = (messages as string[] | undefined)?.[0];
      if (first) fieldErrors[field as ClientField] = first;
    }
    return { status: "error", message: null, fieldErrors };
  }

  const data = parsed.data;
  try {
    if (clientId) {
      await prisma.client.update({ where: { id: clientId }, data });
    } else {
      await prisma.client.create({ data });
    }
  } catch (error) {
    if (isUniqueViolation(error)) {
      return {
        status: "error",
        message: null,
        fieldErrors: { slug: "Another client already uses this slug" },
      };
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return { status: "error", message: "This client no longer exists.", fieldErrors: {} };
    }
    console.error("Saving client failed", error);
    return {
      status: "error",
      message: "Could not save the client. Please try again.",
      fieldErrors: {},
    };
  }

  revalidatePath("/clients", "layout");
  revalidatePath("/");
  redirect(`/clients/${data.slug}`);
}

export async function createClientAction(
  _prev: ClientFormState,
  formData: FormData,
): Promise<ClientFormState> {
  return saveClient(null, formData);
}

export async function updateClientAction(
  clientId: string,
  _prev: ClientFormState,
  formData: FormData,
): Promise<ClientFormState> {
  return saveClient(clientId, formData);
}
