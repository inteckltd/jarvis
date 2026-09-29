import { formatAgo, FRESHNESS, type HealthStatus } from "@jarvis/shared";
import { CheckCheck, CircleAlert, GitBranch, ListChecks, Radar, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ClientCard } from "@/components/dashboard/client-card";
import { StatusPill } from "@/components/dashboard/status-pill";
import { EmptyState } from "@/components/hud/empty-state";
import { HudPanel } from "@/components/hud/hud-panel";
import { SectionLabel } from "@/components/hud/section-label";
import { TaskList } from "@/components/tasks/task-list";
import { Button } from "@/components/ui/button";
import { type Briefing, loadBriefing } from "@/lib/dashboard";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

const WARNING_TEXT: Record<HealthStatus, string> = {
  critical: "text-status-critical",
  warning: "text-status-warning",
  healthy: "text-status-healthy",
  nodata: "text-muted-foreground",
};

function WarningsPanel({ briefing }: { briefing: Briefing }) {
  const items = briefing.clients.flatMap((c) =>
    c.warnings.map((w) => ({ ...w, clientName: c.name, clientSlug: c.slug })),
  );
  const alerts = items.filter((w) => w.status === "critical" || w.status === "warning");
  const gaps = items.filter((w) => w.status === "nodata");
  const total = alerts.length + briefing.accountErrors.length;

  return (
    <HudPanel
      label="Attention"
      title={
        <span className="flex items-center gap-2">
          Warnings
          <span
            className={cn(
              "font-mono text-sm",
              total > 0 ? "text-status-warning" : "text-muted-foreground",
            )}
          >
            {total}
          </span>
        </span>
      }
      corners={false}
    >
      {total === 0 && gaps.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <CheckCheck className="size-4 text-status-healthy" />
          Nothing needs attention in production.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {alerts.length > 0 && (
            <ul className="space-y-2">
              {alerts.map((w) => (
                <li key={`${w.resourceId}-${w.message}`} className="flex items-start gap-2 text-sm">
                  {w.status === "critical" ? (
                    <CircleAlert className="mt-0.5 size-4 shrink-0 text-status-critical" />
                  ) : (
                    <TriangleAlert className="mt-0.5 size-4 shrink-0 text-status-warning" />
                  )}
                  <span className="min-w-0">
                    <Link
                      href={`/clients/${w.clientSlug}/resources/${w.resourceId}`}
                      className="font-medium hover:text-primary"
                    >
                      {w.resourceName}
                    </Link>
                    <span className="text-muted-foreground"> · {w.clientName}</span>
                    <span className={cn("block text-xs", WARNING_TEXT[w.status])}>{w.message}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {briefing.accountErrors.length > 0 && (
            <ul className="space-y-2">
              {briefing.accountErrors.map((a) => (
                <li key={a.id} className="text-sm">
                  <Link
                    href={`/settings/accounts/${a.id}`}
                    className="font-medium hover:text-primary"
                  >
                    {a.label}
                  </Link>
                  <span className="block text-xs text-muted-foreground">{a.message}</span>
                </li>
              ))}
            </ul>
          )}
          {gaps.length > 0 && (
            <details className="group text-xs text-muted-foreground">
              <summary className="cursor-pointer list-none select-none hover:text-foreground [&::-webkit-details-marker]:hidden">
                {gaps.length} data gap{gaps.length === 1 ? "" : "s"} (no recent metrics or checks)
              </summary>
              <ul className="mt-2 space-y-1">
                {gaps.map((w) => (
                  <li key={`${w.resourceId}-${w.message}`}>
                    <span className="text-foreground/80">{w.resourceName}</span> · {w.message}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </HudPanel>
  );
}

function TasksPanel({ briefing }: { briefing: Briefing }) {
  const { overdue, today } = briefing.tasks;
  return (
    <HudPanel
      label="Today"
      title="Tasks"
      corners={false}
      actions={
        <Button asChild variant="ghost" size="sm">
          <Link href="/tasks">
            <ListChecks />
            All tasks
          </Link>
        </Button>
      }
    >
      {overdue.length === 0 && today.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <CheckCheck className="size-4 text-status-healthy" />
          Nothing due today.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {overdue.length > 0 && (
            <div className="space-y-2">
              <SectionLabel className="text-status-critical">
                Overdue · {overdue.length}
              </SectionLabel>
              <TaskList tasks={overdue} now={briefing.now} />
            </div>
          )}
          {today.length > 0 && (
            <div className="space-y-2">
              <SectionLabel>Due today · {today.length}</SectionLabel>
              <TaskList tasks={today} now={briefing.now} />
            </div>
          )}
        </div>
      )}
    </HudPanel>
  );
}

function GithubPanel() {
  return (
    <HudPanel label="GitHub" title="Activity" corners={false} tone="muted">
      <div className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-muted-foreground">Awaiting production</span>
          <span className="font-mono text-2xl text-status-nodata">—</span>
        </div>
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <GitBranch className="mt-0.5 size-3.5 shrink-0" />
          Commits, PRs and what&apos;s on staging but not yet in production appear once the GitHub
          integration is connected (step 11).
        </p>
      </div>
    </HudPanel>
  );
}

export default async function DashboardPage() {
  let briefing: Briefing | null = null;
  try {
    briefing = await loadBriefing();
  } catch (error) {
    console.error("Loading briefing failed", error);
  }

  if (!briefing) {
    return (
      <HudPanel label="System link">
        <EmptyState
          icon={<Radar />}
          title="Database unreachable"
          description="Check DATABASE_URL in .env and that migrations have been applied (pnpm db:deploy)."
        />
      </HudPanel>
    );
  }

  const { now, clients, newestMetricAt } = briefing;
  const staleFor =
    newestMetricAt && now.getTime() - newestMetricAt.getTime() > FRESHNESS.metricsMs
      ? formatAgo(newestMetricAt, now)
      : null;
  const counts = clients.reduce<Record<HealthStatus, number>>(
    (acc, c) => ({ ...acc, [c.status]: acc[c.status] + 1 }),
    { healthy: 0, warning: 0, critical: 0, nodata: 0 },
  );

  return (
    <div className="flex flex-col gap-6">
      {staleFor && (
        <p className="flex items-start gap-2 rounded-md border border-status-nodata/40 bg-status-nodata/10 px-4 py-2.5 text-sm text-muted-foreground">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-status-warning" />
          <span>
            The newest metrics are from {staleFor}, so readings are greyed out. Live collection
            starts with the integrations (step 8 onwards); until then run{" "}
            <code className="font-mono text-primary">pnpm db:seed</code> to refresh the mock data.
          </span>
        </p>
      )}

      {clients.length > 1 && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <SectionLabel className="mr-1">Clients</SectionLabel>
          {(["critical", "warning", "healthy", "nodata"] as const).map((s) =>
            counts[s] > 0 ? <StatusPill key={s} status={s} label={`${counts[s]}`} /> : null,
          )}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-6">
          {clients.length === 0 ? (
            <HudPanel label="Clients">
              <EmptyState
                icon={<Radar />}
                title="No active clients"
                description="Add a client, or run pnpm db:seed to load the IDS pilot data."
                action={
                  <Button asChild size="sm">
                    <Link href="/clients/new">Add client</Link>
                  </Button>
                }
              />
            </HudPanel>
          ) : (
            clients.map((c) => <ClientCard key={c.id} client={c} now={now} />)
          )}
        </div>
        <aside className="flex flex-col gap-6">
          <WarningsPanel briefing={briefing} />
          <TasksPanel briefing={briefing} />
          <GithubPanel />
        </aside>
      </div>
    </div>
  );
}
