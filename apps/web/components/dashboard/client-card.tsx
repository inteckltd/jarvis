import { formatAgo, HEALTH_STATUS_LABEL } from "@jarvis/shared";
import { ChevronRight, Radar, Smartphone } from "lucide-react";
import Link from "next/link";
import { ClientAvatar } from "@/components/clients/client-avatar";
import { EmptyState } from "@/components/hud/empty-state";
import { MetricValue } from "@/components/hud/metric-value";
import { SectionLabel } from "@/components/hud/section-label";
import { StatusDot } from "@/components/hud/status-dot";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ClientBriefing, MobileView, ResourceView } from "@/lib/dashboard";
import { BUILD_STATUS, SHORT_TYPE_LABEL } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { DeployBadge, DeployLine } from "./deploy-line";
import { ResourceTile } from "./resource-tile";
import { StatusPill } from "./status-pill";

const HEADLINE: Record<ClientBriefing["status"], string> = {
  healthy: "All production systems nominal",
  warning: "Production needs attention",
  critical: "Production issue",
  nodata: "Waiting for production data",
};

function DevRow({ r, clientSlug, now }: { r: ResourceView; clientSlug: string; now: Date }) {
  const m = r.evaluation.metricsFresh ? r.metrics : null;
  return (
    <li className="flex flex-col gap-1 py-2 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:gap-4">
      <Link
        href={`/clients/${clientSlug}/resources/${r.id}`}
        className="flex min-w-0 items-center gap-2 text-sm hover:text-primary sm:w-56"
      >
        <StatusDot status={r.evaluation.status} className="size-2 [&>span]:size-2" />
        <span className="truncate">{r.name}</span>
        <span className="shrink-0 text-[11px] text-muted-foreground">
          {SHORT_TYPE_LABEL[r.type]}
        </span>
      </Link>
      <div className="flex flex-1 flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {r.metrics && (
          <span className="font-mono">
            CPU <MetricValue value={m?.cpuPercent ?? null} size="sm" className="text-xs" />% · Mem{" "}
            <MetricValue value={m?.memoryPercent ?? null} size="sm" className="text-xs" />%
          </span>
        )}
        {r.restarts24h !== null && r.restarts24h > 0 && (
          <span className="font-mono">{r.restarts24h} restarts</span>
        )}
        {r.latestDeployment && (
          <span className="flex min-w-0 items-center gap-2">
            <DeployBadge status={r.latestDeployment.status} />
            <span className="font-mono">{formatAgo(r.latestDeployment.startedAt, now)}</span>
          </span>
        )}
        {r.evaluation.reasons[0] && r.evaluation.status !== "healthy" && (
          <span className="truncate">{r.evaluation.reasons[0].message}</span>
        )}
      </div>
    </li>
  );
}

function MobileLine({ app, now }: { app: MobileView; now: Date }) {
  return (
    <div className="flex flex-col gap-2 text-xs sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-5">
      <span className="flex items-center gap-2 text-sm font-medium">
        <Smartphone className="size-4 text-primary" />
        {app.name}
      </span>
      <span className="text-muted-foreground">
        App Store{" "}
        <span className="font-mono text-foreground">
          {app.iosStoreVersion ? app.iosStoreVersion.version : "—"}
        </span>
      </span>
      {app.builds.map((b) => (
        <span key={b.platform} className="flex items-center gap-1.5 text-muted-foreground">
          {b.platform === "IOS" ? "iOS" : "Android"}
          <span className="font-mono text-foreground">
            {b.appVersion} ({b.buildNumber})
          </span>
          <Badge variant={BUILD_STATUS[b.status].variant}>{BUILD_STATUS[b.status].label}</Badge>
          {b.submittedToStore && <Badge variant="outline">Submitted</Badge>}
          <span className="font-mono">{formatAgo(b.createdAt, now)}</span>
        </span>
      ))}
    </div>
  );
}

export function ClientCard({ client, now }: { client: ClientBriefing; now: Date }) {
  const issues = client.warnings.filter((w) => w.status === "critical" || w.status === "warning");
  return (
    <section
      className={cn(
        "hud-corners relative animate-hud-fade-in rounded-lg bg-card hud-border backdrop-blur-sm",
        client.status === "critical" && "shadow-[0_0_32px_-14px_var(--status-critical)]",
      )}
      aria-label={`${client.name}: ${HEALTH_STATUS_LABEL[client.status]}`}
    >
      <header className="flex flex-col gap-4 border-b border-border/70 px-5 py-4 md:flex-row md:items-center md:justify-between">
        <Link href={`/clients/${client.slug}`} className="group flex min-w-0 items-center gap-3">
          <ClientAvatar name={client.name} logoUrl={client.logoUrl} />
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold tracking-tight group-hover:text-primary">
              {client.name}
            </h2>
            <p className="text-xs text-muted-foreground">{HEADLINE[client.status]}</p>
          </div>
        </Link>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <div className="flex flex-col">
            <span className="text-[10px] tracking-wider text-muted-foreground uppercase">
              Uptime 24h
            </span>
            <MetricValue value={client.uptime24h} unit="%" decimals={2} size="sm" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] tracking-wider text-muted-foreground uppercase">
              Restarts 24h
            </span>
            <span
              className={cn(
                "font-mono text-sm tabular-nums",
                client.restarts24h > 0 && "text-status-warning",
              )}
            >
              {client.restarts24h}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] tracking-wider text-muted-foreground uppercase">
              Issues
            </span>
            <span
              className={cn(
                "font-mono text-sm tabular-nums",
                issues.length > 0 && "text-status-warning",
              )}
            >
              {issues.length}
            </span>
          </div>
          <StatusPill status={client.status} className="px-2.5 py-1 text-xs" />
        </div>
      </header>

      <div className="flex flex-col gap-5 px-5 py-4">
        {client.production.length === 0 ? (
          <EmptyState
            icon={<Radar />}
            title="No production resources"
            description="Import this client's apps, databases and projects to see their health here."
            action={
              <Button asChild size="sm">
                <Link href={`/clients/${client.slug}/resources/import`}>Add resources</Link>
              </Button>
            }
            className="py-6"
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {client.production.map((r) => (
              <ResourceTile key={r.id} resource={r} clientSlug={client.slug} now={now} />
            ))}
          </div>
        )}

        {client.recentDeployments.length > 0 && (
          <div className="space-y-2">
            <SectionLabel>Latest production deploys</SectionLabel>
            <ul className="space-y-1.5">
              {client.recentDeployments.map((d) => (
                <li key={d.id}>
                  <DeployLine deployment={d} now={now} showResource />
                </li>
              ))}
            </ul>
          </div>
        )}

        {client.mobile.length > 0 && (
          <div className="space-y-2">
            <SectionLabel>Mobile</SectionLabel>
            {client.mobile.map((app) => (
              <MobileLine key={app.resourceId} app={app} now={now} />
            ))}
          </div>
        )}
      </div>

      {client.development.length > 0 && (
        <details className="group border-t border-border/60 bg-background/20">
          <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-3 text-sm text-muted-foreground select-none hover:text-foreground [&::-webkit-details-marker]:hidden">
            <ChevronRight className="size-4 transition-transform group-open:rotate-90" />
            <SectionLabel className="text-muted-foreground">Development</SectionLabel>
            <span className="font-mono text-xs">{client.development.length} resources</span>
            <span className="ml-auto flex items-center gap-2 text-xs opacity-80">
              <StatusDot
                status={client.developmentStatus}
                className="size-2 [&>span]:size-2 [&>span]:animate-none"
              />
              {HEALTH_STATUS_LABEL[client.developmentStatus]}
            </span>
          </summary>
          <ul className="divide-y divide-border/50 px-5 pb-4 opacity-80">
            {client.development.map((r) => (
              <DevRow key={r.id} r={r} clientSlug={client.slug} now={now} />
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
