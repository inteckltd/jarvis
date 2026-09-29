import { prisma } from "@jarvis/db";
import { isCollectableType } from "@jarvis/shared";
import { TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ConfirmDeleteButton } from "@/components/forms/confirm-delete-button";
import { Breadcrumbs } from "@/components/hud/breadcrumbs";
import { HudPanel } from "@/components/hud/hud-panel";
import { ResourceForm } from "@/components/resources/resource-form";
import { SyncNowButton } from "@/components/resources/sync-now-button";
import { deleteResourceAction, updateResourceAction } from "@/lib/actions/resources";
import { ENVIRONMENT_LABEL } from "@/lib/labels";
import { loadFormAccounts } from "@/lib/resource-form-data";

type Params = { params: Promise<{ slug: string; resourceId: string }> };

async function load({ params }: Params) {
  const { slug, resourceId } = await params;
  return prisma.resource.findFirst({
    where: { id: resourceId, client: { slug } },
    select: {
      id: true,
      clientId: true,
      providerAccountId: true,
      type: true,
      externalId: true,
      name: true,
      environment: true,
      region: true,
      liveUrl: true,
      healthCheckUrl: true,
      repositoryId: true,
      active: true,
      config: true,
      lastError: true,
      client: { select: { name: true, slug: true } },
    },
  });
}

function stringConfig(config: unknown): Record<string, string> {
  if (!config || typeof config !== "object" || Array.isArray(config)) return {};
  return Object.fromEntries(
    Object.entries(config).filter((e): e is [string, string] => typeof e[1] === "string"),
  );
}

export async function generateMetadata(props: Params): Promise<Metadata> {
  const resource = await load(props);
  return { title: resource ? `Edit ${resource.name}` : "Resource not found" };
}

export default async function EditResourcePage(props: Params) {
  const resource = await load(props);
  if (!resource) notFound();

  const [clients, accounts] = await Promise.all([
    prisma.client.findMany({
      orderBy: { name: "asc" },
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
    }),
    loadFormAccounts(resource.clientId),
  ]);
  return (
    <div className="flex flex-col gap-4">
      <Breadcrumbs
        items={[
          { label: "Clients", href: "/clients" },
          { label: resource.client.name, href: `/clients/${resource.client.slug}` },
          {
            label:
              resource.environment === "NONE"
                ? resource.name
                : `${resource.name} (${ENVIRONMENT_LABEL[resource.environment].toLowerCase()})`,
          },
        ]}
      />

      {resource.lastError && (
        <div className="flex max-w-3xl items-start gap-2 rounded-md border border-status-warning/40 bg-status-warning/10 px-3 py-2 text-sm text-status-warning">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <p className="flex-1">{resource.lastError}</p>
          {isCollectableType(resource.type) && (
            <SyncNowButton resourceId={resource.id} variant="outline" />
          )}
        </div>
      )}

      <HudPanel label="Inventory" title={`Edit ${resource.name}`} className="max-w-3xl">
        <ResourceForm
          mode="edit"
          initial={{
            clientId: resource.clientId,
            providerAccountId: resource.providerAccountId,
            type: resource.type,
            externalId: resource.externalId,
            name: resource.name,
            environment: resource.environment,
            region: resource.region ?? "",
            liveUrl: resource.liveUrl ?? "",
            healthCheckUrl: resource.healthCheckUrl ?? "",
            repositoryId: resource.repositoryId ?? "",
            active: resource.active,
            config: stringConfig(resource.config),
          }}
          clients={clients}
          accounts={accounts}
          action={updateResourceAction.bind(null, resource.id)}
          cancel={{ href: `/clients/${resource.client.slug}` }}
        />
      </HudPanel>

      <HudPanel label="Danger zone" title="Delete resource" tone="muted" className="max-w-3xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Also deletes its metrics, health checks, deployments and builds. Nothing changes at the
            provider.
          </p>
          <ConfirmDeleteButton
            action={deleteResourceAction.bind(null, resource.id)}
            confirmText={`Delete ${resource.name} and all of its history from Jarvis?`}
          />
        </div>
      </HudPanel>
    </div>
  );
}
