import { prisma } from "@jarvis/db";
import {
  CHART_RANGES,
  type ChartRange,
  dateOnlyKey,
  type HealthStatus,
  isChartRange,
  londonDateOnlyBounds,
  RANGE_SPEC,
} from "@jarvis/shared";
import {
  ExternalLink,
  GitBranch,
  ListChecks,
  Mail,
  Pencil,
  Plus,
  Radar,
  Server,
  Smartphone,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActivityTimeline } from "@/components/clients/activity-timeline";
import { ClientAvatar } from "@/components/clients/client-avatar";
import { MobilePanel } from "@/components/clients/mobile-panel";
import { ResourceDetail } from "@/components/clients/resource-detail";
import { ResourceList } from "@/components/clients/resource-list";
import { StatusPill } from "@/components/dashboard/status-pill";
import { Breadcrumbs } from "@/components/hud/breadcrumbs";
import { EmptyState } from "@/components/hud/empty-state";
import { HudPanel } from "@/components/hud/hud-panel";
import { SectionLabel } from "@/components/hud/section-label";
import { StatusDot } from "@/components/hud/status-dot";
import { QuickAddTask } from "@/components/tasks/quick-add-task";
import { TaskList } from "@/components/tasks/task-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { loadActivity, loadMobile } from "@/lib/client-activity";
import { loadResourceSeries } from "@/lib/client-charts";
import { loadBriefing, type ResourceView } from "@/lib/dashboard";
import { loadTaskClients, TASK_LIST_SELECT } from "@/lib/tasks";
import { cn } from "@/lib/utils";

const TASK_PREVIEW_LIMIT = 6;

const TABS = ["production", "development", "mobile", "activity"] as const;
type Tab = (typeof TABS)[number];
const TAB_LABEL: Record<Tab, string> = {
  production: "Production",
  development: "Development",
  mobile: "Mobile",
  activity: "Activity",
};
const RANGE_LABEL: Record<ChartRange, string> = { "24h": "24h", "7d": "7d", "30d": "30d" };

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tab?: string | string[]; range?: string | string[] }>;
};

export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
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
          config: true,
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

  const [openTasks, overdueTasks, upNext, clients] = await Promise.all([
    prisma.task.count({ where: { clientId: client.id, completed: false } }),
    prisma.task.count({ where: { clientId: client.id, completed: false, dueDate: { lt: start } } }),
    prisma.task.findMany({
      where: { clientId: client.id, completed: false },
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
      take: TASK_PREVIEW_LIMIT,
      select: TASK_LIST_SELECT,
    }),
    loadTaskClients(),
  ]);
  return { client, openTasks, overdueTasks, upNext, clients };
}

function one(v: string | string[] | undefined): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function isTab(v: unknown): v is Tab {
  return typeof v === "string" && (TABS as readonly string[]).includes(v);
}

async function EnvironmentTab({
  resources,
  range,
  clientSlug,
  now,
  muted,
}: {
  resources: ResourceView[];
  range: ChartRange;
  clientSlug: string;
  now: Date;
  muted: boolean;
}) {
  const series = await loadResourceSeries(
    resources.map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type,
      environment: r.environment,
      hasHealthCheck: r.evaluation.health !== null,
    })),
    range,
    now,
  );
  return (
    <div className="flex flex-col gap-5">
      {resources.map((r) => {
        const s = series.get(r.id);
        return s ? (
          <ResourceDetail
            key={r.id}
            resource={r}
            series={s}
            range={range}
            clientSlug={clientSlug}
            now={now}
            muted={muted}
          />
        ) : null;
      })}
    </div>
  );
}

export default async function ClientDetailPage({ params, searchParams }: Props) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const loaded = await loadClient(slug);
  if (!loaded) notFound();
  const { client, openTasks, overdueTasks, upNext, clients } = loaded;

  const tabParam = one(query.tab);
  const tab: Tab = isTab(tabParam) ? tabParam : "production";
  const rangeParam = one(query.range);
  const range: ChartRange = isChartRange(rangeParam) ? rangeParam : "24h";

  const now = new Date();
  const briefing = (await loadBriefing(now, { clientId: client.id })).clients[0];
  const production = briefing?.production ?? [];
  const development = briefing?.development ?? [];
  const mobileResources = client.resources.filter((r) => r.active && r.type === "EXPO_APP");
  const otherResources = client.resources.filter(
    (r) => r.active && r.environment === "NONE" && r.type !== "EXPO_APP",
  );
  const inactive = client.resources.filter((r) => !r.active);
  const base = `/clients/${client.slug}`;

  const tabStatus: Partial<Record<Tab, HealthStatus>> = {
    production: briefing?.status,
    development: briefing?.developmentStatus,
  };
  const tabCount: Record<Tab, number | null> = {
    production: production.length,
    development: development.length,
    mobile: mobileResources.length + otherResources.length,
    activity: null,
  };
  const href = (next: { tab?: Tab; range?: ChartRange }) => {
    const params = new URLSearchParams();
    const t = next.tab ?? tab;
    const r = next.range ?? range;
    if (t !== "production") params.set("tab", t);
    if (r !== "24h") params.set("range", r);
    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
  };
  const showRange = tab !== "mobile";

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs items={[{ label: "Clients", href: "/clients" }, { label: client.name }]} />

      <HudPanel
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href={`${base}/edit`}>
              <Pencil />
              Edit
            </Link>
          </Button>
        }
        label="Client"
        title={
          <span className="flex items-center gap-3">
            {client.name}
            {briefing && <StatusPill status={briefing.status} />}
            {!client.active && <Badge variant="nodata">Inactive</Badge>}
          </span>
        }
      >
        <div className="flex flex-col gap-6 md:flex-row md:items-start">
          <ClientAvatar name={client.name} logoUrl={client.logoUrl} size="lg" />
          <div className="grid flex-1 gap-6 sm:grid-cols-2">
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
              <p className="line-clamp-4 text-sm whitespace-pre-wrap text-muted-foreground">
                {client.notes ?? "No notes."}
              </p>
            </div>
          </div>
        </div>
      </HudPanel>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-5">
          <div className="flex flex-col gap-3 border-b border-border/60 pb-3 md:flex-row md:items-center md:justify-between">
            <nav aria-label="Client sections" className="flex flex-wrap gap-1">
              {TABS.map((t) => {
                const status = tabStatus[t];
                const count = tabCount[t];
                return (
                  <Link
                    key={t}
                    href={href({ tab: t })}
                    aria-current={t === tab ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors",
                      t === tab
                        ? "border-primary/50 bg-primary/10 text-primary shadow-[0_0_14px_-6px_var(--glow)]"
                        : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
                    )}
                  >
                    {status && count ? (
                      <StatusDot
                        status={status}
                        className={cn(
                          "size-2 [&>span]:size-2",
                          t === "development" && "opacity-70 [&>span]:animate-none",
                        )}
                      />
                    ) : null}
                    {TAB_LABEL[t]}
                    {count !== null && <span className="font-mono text-xs">{count}</span>}
                  </Link>
                );
              })}
            </nav>
            <div className="flex items-center gap-3">
              {showRange && (
                <nav
                  aria-label="Time range"
                  className="flex rounded-md border border-border/70 p-0.5"
                >
                  {CHART_RANGES.map((r) => (
                    <Link
                      key={r}
                      href={href({ range: r })}
                      aria-current={r === range ? "true" : undefined}
                      className={cn(
                        "rounded px-2.5 py-1 font-mono text-xs transition-colors",
                        r === range
                          ? "bg-primary/15 text-primary"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {RANGE_LABEL[r]}
                    </Link>
                  ))}
                </nav>
              )}
              <Button asChild size="sm">
                <Link href={`${base}/resources/import`}>
                  <Radar />
                  Add resources
                </Link>
              </Button>
            </div>
          </div>

          {tab === "production" &&
            (production.length ? (
              <EnvironmentTab
                resources={production}
                range={range}
                clientSlug={client.slug}
                now={now}
                muted={false}
              />
            ) : (
              <HudPanel corners={false}>
                <EmptyState
                  icon={<Server />}
                  title="No production resources"
                  description="Pick DigitalOcean, Supabase, Vercel or Expo and import this client's apps, databases and projects."
                  action={
                    <Button asChild size="sm">
                      <Link href={`${base}/resources/import`}>
                        <Plus />
                        Add resources
                      </Link>
                    </Button>
                  }
                  className="py-8"
                />
              </HudPanel>
            ))}

          {tab === "development" &&
            (development.length ? (
              <>
                <p className="text-xs text-muted-foreground">
                  Development is shown for context and never changes {client.name}&apos;s status.
                </p>
                <EnvironmentTab
                  resources={development}
                  range={range}
                  clientSlug={client.slug}
                  now={now}
                  muted
                />
              </>
            ) : (
              <HudPanel corners={false} tone="muted">
                <EmptyState
                  icon={<Server />}
                  title="No development resources"
                  description="Import the staging / pre-production apps as DEVELOPMENT to see them here."
                  className="py-8"
                />
              </HudPanel>
            ))}

          {tab === "mobile" && (
            <MobileTab
              resources={mobileResources}
              other={otherResources}
              clientSlug={client.slug}
            />
          )}

          {tab === "activity" && <ActivityTab clientId={client.id} range={range} now={now} />}

          {inactive.length > 0 && (
            <details className="group rounded-lg border border-border/60 bg-card/40">
              <summary className="cursor-pointer list-none px-5 py-3 text-sm text-muted-foreground select-none hover:text-foreground [&::-webkit-details-marker]:hidden">
                {inactive.length} inactive resource{inactive.length === 1 ? "" : "s"}
              </summary>
              <div className="border-t border-border/60 px-5 py-4">
                <ResourceList resources={inactive} clientSlug={client.slug} muted />
              </div>
            </details>
          )}
        </div>

        <aside className="flex flex-col gap-6">
          <HudPanel
            label="Tasks"
            title={
              <span className="flex items-center gap-2">
                Open tasks
                <span className="font-mono text-sm text-muted-foreground">{openTasks}</span>
                {overdueTasks > 0 && <Badge variant="critical">{overdueTasks} overdue</Badge>}
              </span>
            }
            corners={false}
            actions={
              <Button asChild variant="ghost" size="sm">
                <Link href={`/tasks?client=${client.slug}`}>
                  <ListChecks />
                  All
                </Link>
              </Button>
            }
          >
            <QuickAddTask
              clients={clients}
              today={dateOnlyKey(now)}
              defaultClientId={client.id}
              fixedClient
              className="mb-4 [&_input[type=date]]:md:w-full [&>div]:md:flex-col [&>div]:md:items-stretch"
            />
            {upNext.length ? (
              <>
                <TaskList tasks={upNext} now={now} showClient={false} />
                {openTasks > upNext.length && (
                  <Link
                    href={`/tasks?client=${client.slug}`}
                    className="mt-3 inline-block text-xs text-primary hover:underline"
                  >
                    {openTasks - upNext.length} more open
                  </Link>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No open tasks.</p>
            )}
          </HudPanel>

          <HudPanel
            label="GitHub"
            title="Repositories"
            corners={false}
            actions={
              <Button asChild variant="ghost" size="sm">
                <Link href={`${base}/repositories/new`}>
                  <Plus />
                  Add
                </Link>
              </Button>
            }
          >
            {client.repositories.length ? (
              <ul className="divide-y divide-border/60">
                {client.repositories.map((repo) => (
                  <li key={repo.id} className="flex flex-col gap-1.5 py-2.5 first:pt-0 last:pb-0">
                    <div className="flex items-center justify-between gap-2">
                      <a
                        href={`https://github.com/${repo.owner}/${repo.name}`}
                        target="_blank"
                        rel="noreferrer"
                        className="group flex min-w-0 items-center gap-2 font-mono text-sm hover:text-primary"
                      >
                        <GitBranch className="size-4 shrink-0 text-primary" />
                        <span className="truncate">{repo.name}</span>
                        <ExternalLink className="size-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
                      </a>
                      <Button asChild variant="ghost" size="icon" className="size-7 shrink-0">
                        <Link
                          href={`${base}/repositories/${repo.id}`}
                          aria-label={`Edit ${repo.owner}/${repo.name}`}
                        >
                          <Pencil />
                        </Link>
                      </Button>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 pl-6">
                      <Badge variant="outline">{repo.productionBranch} → prod</Badge>
                      {repo.developmentBranch && (
                        <Badge variant="outline">{repo.developmentBranch} → dev</Badge>
                      )}
                      {!repo.active && <Badge variant="nodata">Inactive</Badge>}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                No repositories linked. Link them to track releases.
              </p>
            )}
          </HudPanel>
        </aside>
      </div>
    </div>
  );
}

async function MobileTab({
  resources,
  other,
  clientSlug,
}: {
  resources: { id: string; name: string; config: unknown }[];
  other: Parameters<typeof ResourceList>[0]["resources"];
  clientSlug: string;
}) {
  const data = await loadMobile(resources.map((r) => r.id));
  if (resources.length === 0 && other.length === 0) {
    return (
      <HudPanel corners={false}>
        <EmptyState
          icon={<Smartphone />}
          title="No mobile apps"
          description="Import the Expo project from the Expo account to track builds and store versions."
          className="py-8"
        />
      </HudPanel>
    );
  }
  return (
    <div className="flex flex-col gap-5">
      {resources.map((r) => {
        const d = data.get(r.id);
        const config =
          r.config && typeof r.config === "object" && !Array.isArray(r.config)
            ? (r.config as Record<string, unknown>)
            : {};
        return (
          <MobilePanel
            key={r.id}
            resource={{ id: r.id, name: r.name, config }}
            versions={d?.versions ?? []}
            builds={d?.builds ?? []}
            clientSlug={clientSlug}
          />
        );
      })}
      {other.length > 0 && (
        <HudPanel label="Other" title="Other resources" corners={false}>
          <ResourceList resources={other} clientSlug={clientSlug} />
        </HudPanel>
      )}
    </div>
  );
}

async function ActivityTab({
  clientId,
  range,
  now,
}: {
  clientId: string;
  range: ChartRange;
  now: Date;
}) {
  const days = await loadActivity(clientId, new Date(now.getTime() - RANGE_SPEC[range].durationMs));
  return (
    <HudPanel label="Activity" title="Deploys, builds and completed tasks" corners={false}>
      <ActivityTimeline days={days} />
      <p className="mt-5 flex items-center gap-2 border-t border-border/60 pt-3 text-xs text-muted-foreground">
        <GitBranch className="size-3.5" />
        Commits and pull requests join this timeline with the GitHub integration (step 11).
      </p>
    </HudPanel>
  );
}
