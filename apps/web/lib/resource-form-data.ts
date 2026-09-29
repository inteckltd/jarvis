import "server-only";
import { prisma } from "@jarvis/db";
import type { ResourceFormAccount, ResourceFormClient } from "@/components/resources/resource-form";

/** A client with its repositories, shaped for ResourceForm. */
export async function loadFormClient(slug: string): Promise<ResourceFormClient | null> {
  return prisma.client.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      repositories: {
        orderBy: { name: "asc" },
        select: {
          id: true,
          owner: true,
          name: true,
          productionBranch: true,
          developmentBranch: true,
        },
      },
    },
  });
}

/** Accounts usable for a client: Inteck-owned ones plus the client's own. */
export async function loadFormAccounts(clientId: string): Promise<ResourceFormAccount[]> {
  return prisma.providerAccount.findMany({
    where: { OR: [{ clientId: null }, { clientId }], provider: { not: "AWS" } },
    orderBy: [{ provider: "asc" }, { label: "asc" }],
    select: { id: true, label: true, provider: true, clientId: true },
  });
}
