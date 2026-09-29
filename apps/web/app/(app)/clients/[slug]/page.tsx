import { prisma } from "@jarvis/db";
import { londonDateOnlyBounds } from "@jarvis/shared";
import { ChevronRight, ExternalLink, GitBranch, Mail, Pencil, Server } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ClientAvatar } from "@/components/clients/client-avatar";
import { ResourceList } from "@/components/clients/resource-list";
import { Breadcrumbs } from "@/components/hud/breadcrumbs";
import { EmptyState } from "@/components/hud/empty-state";
import { HudPanel } from "@/components/hud/hud-panel";
import { SectionLabel } from "@/components/hud/section-label";
import { Stat } from "@/components/hud/stat";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const client = await prisma.client.findUnique({ where: { slug }, select: { name: true } });
  return { title: client?.name ?? "Client not found" };
}

async function loadClient(slug: string) {
  const { start } = londonDateOnlyBounds(new Date());
  const client = await prisma.client.findUnique({
    where: { slug },
    include: {
      resources: {
        orderBy: [{ active: "desc" }, { name: "asc" }, { type: "asc" }],
        select: {
          id: true,
          name: true,
          type: true,
          environment: true,
          region: true,
          liveUrl: true,
          healthCheckUrl: true,
          lastError: true,
          active: true,
          providerAccount: { select: { label: true, provider: true } },
          repository: { select: { owner: true, name: true } },
        },
      },
      repositories: {
        orderBy: { name: "asc" },
        include: { _count: { select: { resources: true } } },
      },
    },
  });
  if (!client) return null;

  const [openTasks, overdueTasks] = await Promise.all([
    prisma.task.count({ where: { clientId: client.id, completed: false } }),
    prisma.task.count({ where: { clientId: client.id, completed: false, dueDate: { lt: start } } }),
  ]);
  return { client, openTasks, overdueTasks };
}

export default async function ClientDetailPage({ params }: Params) {
  const { slug } = await params;
  const loaded = await loadClient(slug);
  if (!loaded) notFound();
  const { client, openTasks, overdueTasks } = loaded;

  const production = client.resources.filter((r) => r.environment === "PRODUCTION");
  const development = client.resources.filter((r) => r.environment === "DEVELOPMENT");
  const other = client.resources.filter((r) => r.environment === "NONE");

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs items={[{ label: "Clients", href: "/clients" }, { label: client.name }]} />

      <HudPanel
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href={`/clients/${client.slug}/edit`}>
              <Pencil />
              Edit
            </Link>
          </Button>
        }
        label="Client"
        title={
          <span className="flex items-center gap-3">
            {client.name}
            {client.active ? (
              <Badge variant="healthy">Active</Badge>
            ) : (
              <Badge variant="nodata">Inactive</Badge>
            )}
          </span>
        }
      >
        <div className="flex flex-col gap-6 md:flex-row md:items-start">
          <ClientAvatar name={client.name} logoUrl={client.logoUrl} size="lg" />
          <div className="grid flex-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Production" value={production.length} hint="resources" />
            <Stat label="Development" value={development.length} hint="resources" />
            <Stat label="Repositories" value={client.repositories.length} />
            <Stat
              label="Open tasks"
              value={openTasks}
              hint={
                overdueTasks > 0 ? (
                  <span className="text-status-warning">{overdueTasks} overdue</span>
                ) : undefined
              }
            />
          </div>
        </div>

        <div className="mt-6 grid gap-6 border-t border-border/70 pt-5 md:grid-cols-2">
          <div className="space-y-2">
            <SectionLabel>Contact</SectionLabel>
            {client.contactName || client.contactEmail ? (
              <div className="space-y-1 text-sm">
                {client.contactName && <p>{client.contactName}</p>}
                {client.contactEmail && (
                  <a
                    href={`mailto:${client.contactEmail}`}
                    className="flex items-center gap-1.5 font-mono text-primary/90 hover:text-primary"
                  >
                    <Mail className="size-3.5" />
                    {client.contactEmail}
                  </a>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No contact details.</p>
            )}
          </div>
          <div className="space-y-2">
            <SectionLabel>Notes</SectionLabel>
            <p className="text-sm whitespace-pre-wrap text-muted-foreground">
              {client.notes ?? "No notes."}
            </p>
          </div>
        </div>
      </HudPanel>

      <HudPanel label="Production" title="Production resources">
        {production.length ? (
          <ResourceList resources={production} />
        ) : (
          <EmptyState
            icon={<Server />}
            title="No production resources"
            description="Import resources from a provider account (step 4)."
            className="py-8"
          />
        )}
      </HudPanel>

      {development.length > 0 && (
        <details className="group rounded-lg border border-border/60 bg-card/40">
          <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-3 text-sm text-muted-foreground select-none hover:text-foreground [&::-webkit-details-marker]:hidden">
            <ChevronRight className="size-4 transition-transform group-open:rotate-90" />
            <SectionLabel className="text-muted-foreground">Development</SectionLabel>
            <span className="font-mono text-xs">{development.length} resources</span>
          </summary>
          <div className="border-t border-border/60 px-5 py-4">
            <ResourceList resources={development} muted />
          </div>
        </details>
      )}

      {other.length > 0 && (
        <HudPanel label="Mobile & other" title="Other resources" corners={false}>
          <ResourceList resources={other} />
        </HudPanel>
      )}

      <HudPanel label="GitHub" title="Repositories" corners={false}>
        {client.repositories.length ? (
          <ul className="divide-y divide-border/60">
            {client.repositories.map((repo) => (
              <li
                key={repo.id}
                className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <a
                  href={`https://github.com/${repo.owner}/${repo.name}`}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex min-w-0 items-center gap-2 font-mono text-sm hover:text-primary"
                >
                  <GitBranch className="size-4 shrink-0 text-primary" />
                  <span className="truncate">
                    <span className="text-muted-foreground">{repo.owner}/</span>
                    {repo.name}
                  </span>
                  <ExternalLink className="size-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
                </a>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{repo.productionBranch} → prod</Badge>
                  {repo.developmentBranch ? (
                    <Badge variant="outline">{repo.developmentBranch} → dev</Badge>
                  ) : (
                    <Badge variant="outline" className="opacity-60">
                      no dev branch
                    </Badge>
                  )}
                  {!repo.active && <Badge variant="nodata">Inactive</Badge>}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={<GitBranch />}
            title="No repositories linked"
            description="Link GitHub repositories when resources are set up (step 4)."
            className="py-8"
          />
        )}
      </HudPanel>
    </div>
  );
}
