import { prisma } from "@jarvis/db";
import { londonDateOnlyBounds } from "@jarvis/shared";
import { Activity, Gauge, GitBranch, ListChecks, Radar } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/hud/empty-state";
import { HudPanel } from "@/components/hud/hud-panel";
import { Stat } from "@/components/hud/stat";
import { StatusDot } from "@/components/hud/status-dot";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Dashboard" };

async function loadSummary() {
  const { start, end } = londonDateOnlyBounds(new Date());
  const [clients, production, development, dueToday, overdue, lastSnapshot] = await Promise.all([
    prisma.client.count({ where: { active: true } }),
    prisma.resource.count({ where: { active: true, environment: "PRODUCTION" } }),
    prisma.resource.count({ where: { active: true, environment: "DEVELOPMENT" } }),
    prisma.task.count({ where: { completed: false, dueDate: { gte: start, lt: end } } }),
    prisma.task.count({ where: { completed: false, dueDate: { lt: start } } }),
    prisma.metricSnapshot.findFirst({
      orderBy: { capturedAt: "desc" },
      select: { capturedAt: true },
    }),
  ]);
  return {
    clients,
    production,
    development,
    dueToday,
    overdue,
    lastSnapshot: lastSnapshot?.capturedAt ?? null,
  };
}

const UPCOMING = [
  {
    icon: Gauge,
    title: "Client health",
    body: "Production RAG status, gauges, uptime and restarts per client.",
  },
  {
    icon: Activity,
    title: "Deployments",
    body: "Latest deploys and builds, with development shown separately.",
  },
  {
    icon: GitBranch,
    title: "GitHub activity",
    body: "Commits, PRs and what is on staging awaiting production.",
  },
];

export default async function DashboardPage() {
  let summary: Awaited<ReturnType<typeof loadSummary>> | null = null;
  try {
    summary = await loadSummary();
  } catch (error) {
    console.error("Dashboard summary failed", error);
  }

  if (!summary) {
    return (
      <HudPanel label="System link">
        <EmptyState
          icon={<Radar />}
          title="Database unreachable"
          description="Check DATABASE_URL in .env and that migrations have been applied (pnpm db:migrate)."
        />
      </HudPanel>
    );
  }

  const hasData = summary.clients > 0;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <HudPanel
        label="System link"
        title="Jarvis database"
        className="lg:col-span-2"
        actions={
          <Badge variant={hasData ? "healthy" : "nodata"}>
            <StatusDot
              status={hasData ? "healthy" : "nodata"}
              className="size-1.5 [&>span]:size-1.5"
            />
            {hasData ? "Online" : "Empty"}
          </Badge>
        }
      >
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
          <Stat label="Clients" value={summary.clients} />
          <Stat label="Production" value={summary.production} hint="resources" />
          <Stat label="Development" value={summary.development} hint="resources" />
          <Stat
            label="Last metric"
            value={
              summary.lastSnapshot
                ? Math.round((Date.now() - summary.lastSnapshot.getTime()) / 60_000)
                : null
            }
            hint="minutes ago"
          />
        </div>
        {!hasData && (
          <p className="mt-4 text-sm text-muted-foreground">
            No clients yet. Run <code className="font-mono text-primary">pnpm db:seed</code> to load
            the IDS pilot data.
          </p>
        )}
      </HudPanel>

      <HudPanel label="Today" title="Tasks">
        <div className="grid grid-cols-2 gap-6">
          <Stat label="Due today" value={summary.dueToday} />
          <div className="flex flex-col gap-1">
            <span className="text-[11px] tracking-wider text-muted-foreground uppercase">
              Overdue
            </span>
            <span
              className={
                summary.overdue > 0
                  ? "font-mono text-2xl font-medium text-status-warning tabular-nums"
                  : "font-mono text-2xl font-medium tabular-nums"
              }
            >
              {summary.overdue}
            </span>
          </div>
        </div>
        <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <ListChecks className="size-3.5" /> Task views arrive in step 5.
        </p>
      </HudPanel>

      <HudPanel
        label="Coming online"
        title="Morning briefing"
        className="lg:col-span-3"
        corners={false}
      >
        <ul className="grid gap-4 md:grid-cols-3">
          {UPCOMING.map(({ icon: Icon, title, body }) => (
            <li
              key={title}
              className="flex gap-3 rounded-md border border-border/60 bg-background/40 p-4"
            >
              <Icon className="mt-0.5 size-4 shrink-0 text-primary" />
              <div className="space-y-1">
                <p className="text-sm font-medium">{title}</p>
                <p className="text-sm text-muted-foreground">{body}</p>
              </div>
            </li>
          ))}
        </ul>
      </HudPanel>
    </div>
  );
}
