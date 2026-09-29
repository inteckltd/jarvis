import {
  type ChartRange,
  DEFAULT_THRESHOLDS,
  DISK_NOT_APPLICABLE,
  formatAgo,
  formatBytes,
  formatCount,
  type HealthStatus,
  isCollectableType,
  seriesStats,
} from "@jarvis/shared";
import { ExternalLink, Pencil } from "lucide-react";
import Link from "next/link";
import type * as React from "react";
import { TimeChart } from "@/components/charts/time-chart";
import { UptimeStrip } from "@/components/charts/uptime-strip";
import { DeployLine } from "@/components/dashboard/deploy-line";
import { StatusPill } from "@/components/dashboard/status-pill";
import { SectionLabel } from "@/components/hud/section-label";
import { SyncNowButton } from "@/components/resources/sync-now-button";
import { Button } from "@/components/ui/button";
import type { ResourceSeries } from "@/lib/client-charts";
import type { ResourceView } from "@/lib/dashboard";
import { RESOURCE_TYPE_LABEL } from "@/lib/labels";
import { cn } from "@/lib/utils";

const REASON_TEXT: Record<HealthStatus, string> = {
  critical: "text-status-critical",
  warning: "text-status-warning",
  healthy: "text-status-healthy",
  nodata: "text-status-nodata",
};

const RANGE_LABEL: Record<ChartRange, string> = { "24h": "24h", "7d": "7 days", "30d": "30 days" };
const DEPLOYABLE: readonly ResourceView["type"][] = [
  "DO_APP",
  "VERCEL_PROJECT",
  "SUPABASE_FUNCTIONS",
];
const DEPLOYS_SHOWN = 5;

function Fact({
  label,
  children,
  tone,
}: {
  label: string;
  children: React.ReactNode;
  tone?: HealthStatus;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] tracking-wider text-muted-foreground uppercase">{label}</span>
      <span
        className={cn(
          "font-mono text-sm tabular-nums",
          tone === "warning" && "text-status-warning",
          tone === "critical" && "text-status-critical",
        )}
      >
        {children}
      </span>
    </div>
  );
}

function pct(v: number | null): string {
  return v === null ? "—" : `${Math.round(v)}%`;
}

function ChartBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <SectionLabel>{title}</SectionLabel>
      {children}
    </div>
  );
}

export function ResourceDetail({
  resource: r,
  series: s,
  range,
  clientSlug,
  now,
  muted = false,
}: {
  resource: ResourceView;
  series: ResourceSeries;
  range: ChartRange;
  clientSlug: string;
  now: Date;
  muted?: boolean;
}) {
  const e = r.evaluation;
  const cpu = s.metrics ? seriesStats(s.metrics.map((p) => p.cpu)) : null;
  const cpuPeak = s.metrics ? seriesStats(s.metrics.map((p) => p.cpuMax)).max : null;
  const mem = s.metrics ? seriesStats(s.metrics.map((p) => p.memory)) : null;
  const memPeak = s.metrics ? seriesStats(s.metrics.map((p) => p.memoryMax)).max : null;
  const restarts = s.restarts?.reduce((sum, p) => sum + p.restarts, 0) ?? null;
  const failed = s.deployments.filter((d) => d.status === "FAILED").length;
  const fnTotals = s.functions?.reduce(
    (acc, f) => ({ invocations: acc.invocations + f.invocations, errors: acc.errors + f.errors }),
    { invocations: 0, errors: 0 },
  );
  const dbSizes = s.metrics?.map((p) => p.dbSize).filter((v): v is number => v !== null) ?? [];
  const dbGrowth =
    dbSizes.length > 1 ? (dbSizes[dbSizes.length - 1] ?? 0) - (dbSizes[0] ?? 0) : null;
  const hasDisk = r.type === "SUPABASE_PROJECT" || r.type === "DO_DROPLET" || r.type === "AWS_EC2";

  return (
    <section
      className={cn(
        "rounded-lg border bg-card/70 backdrop-blur-sm",
        muted ? "border-border/60 bg-card/40" : "hud-border",
      )}
    >
      <header className="flex flex-col gap-3 border-b border-border/70 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 font-semibold">
            <span className="truncate">{r.name}</span>
            <StatusPill status={e.status} />
          </h3>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
            {RESOURCE_TYPE_LABEL[r.type]}
            {r.liveUrl && (
              <a
                href={r.liveUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 font-mono text-primary/90 hover:text-primary"
              >
                {r.liveUrl.replace(/^https?:\/\//, "")}
                <ExternalLink className="size-3" />
              </a>
            )}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {isCollectableType(r.type) && <SyncNowButton resourceId={r.id} />}
          <Button asChild variant="ghost" size="sm">
            <Link href={`/clients/${clientSlug}/resources/${r.id}`}>
              <Pencil />
              Settings
            </Link>
          </Button>
        </div>
      </header>

      <div className="flex flex-col gap-5 px-5 py-4">
        <div className="flex flex-wrap gap-x-7 gap-y-3">
          {cpu && (
            <>
              <Fact label={`CPU avg / peak`}>
                {pct(cpu.avg)} <span className="text-muted-foreground">/</span> {pct(cpuPeak)}
              </Fact>
              <Fact label="Memory avg / peak">
                {pct(mem?.avg ?? null)} <span className="text-muted-foreground">/</span>{" "}
                {pct(memPeak)}
              </Fact>
            </>
          )}
          {s.health && (
            <Fact
              label={`Uptime ${RANGE_LABEL[range]}`}
              tone={
                s.uptime === null
                  ? undefined
                  : s.uptime < 99
                    ? "critical"
                    : s.uptime < 99.9
                      ? "warning"
                      : undefined
              }
            >
              {s.uptime === null ? "—" : `${s.uptime}%`}
            </Fact>
          )}
          {restarts !== null && (
            <Fact label="Restarts" tone={restarts > 0 ? "warning" : undefined}>
              {restarts}
            </Fact>
          )}
          {DEPLOYABLE.includes(r.type) && (
            <Fact label="Deploys" tone={failed > 0 ? "warning" : undefined}>
              {s.deployments.length}
              {failed > 0 && <span className="text-status-critical"> ({failed} failed)</span>}
            </Fact>
          )}
          {r.type === "SUPABASE_PROJECT" && (
            <>
              <Fact label="DB size">
                {r.metrics?.dbSizeBytes != null ? formatBytes(r.metrics.dbSizeBytes) : "—"}
              </Fact>
              {dbGrowth !== null && (
                <Fact label={`Growth ${RANGE_LABEL[range]}`}>
                  {dbGrowth >= 0 ? "+" : "−"}
                  {formatBytes(Math.abs(dbGrowth))}
                </Fact>
              )}
            </>
          )}
          {fnTotals && (
            <>
              <Fact label="Invocations">{formatCount(fnTotals.invocations)}</Fact>
              <Fact label="Errors" tone={fnTotals.errors > 0 ? "warning" : undefined}>
                {formatCount(fnTotals.errors)}
                {fnTotals.invocations > 0 && (
                  <span className="text-muted-foreground">
                    {" "}
                    ({((fnTotals.errors / fnTotals.invocations) * 100).toFixed(2)}%)
                  </span>
                )}
              </Fact>
            </>
          )}
          {r.metrics && (
            <Fact label="Last sample">
              <span className={cn(!e.metricsFresh && "text-status-nodata")}>
                {formatAgo(r.metrics.capturedAt, now)}
              </span>
            </Fact>
          )}
        </div>

        {e.reasons.length > 0 && (
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
            {e.reasons.map((reason) => (
              <li key={reason.message} className={REASON_TEXT[reason.status]}>
                {reason.message}
              </li>
            ))}
          </ul>
        )}

        {s.metrics && (
          <div className="grid gap-5 lg:grid-cols-2">
            <ChartBlock title="CPU">
              <TimeChart
                data={s.metrics}
                unit="percent"
                range={range}
                thresholds={DEFAULT_THRESHOLDS}
                series={[
                  { key: "cpuMax", label: "Peak", color: "var(--chart-1)", faint: true },
                  { key: "cpu", label: "Average", color: "var(--chart-1)" },
                ]}
              />
            </ChartBlock>
            <ChartBlock title="Memory">
              <TimeChart
                data={s.metrics}
                unit="percent"
                range={range}
                thresholds={DEFAULT_THRESHOLDS}
                series={[
                  { key: "memoryMax", label: "Peak", color: "var(--chart-2)", faint: true },
                  { key: "memory", label: "Average", color: "var(--chart-2)" },
                ]}
              />
            </ChartBlock>
            {hasDisk && (
              <ChartBlock title="Disk">
                {DISK_NOT_APPLICABLE.includes(r.type) ? (
                  <p className="text-xs text-status-na">N/A</p>
                ) : (
                  <TimeChart
                    data={s.metrics}
                    unit="percent"
                    range={range}
                    thresholds={DEFAULT_THRESHOLDS}
                    series={[{ key: "disk", label: "Disk", color: "var(--chart-5)" }]}
                  />
                )}
              </ChartBlock>
            )}
            {r.type === "SUPABASE_PROJECT" && (
              <ChartBlock title="Database size">
                <TimeChart
                  data={s.metrics}
                  unit="bytes"
                  range={range}
                  series={[{ key: "dbSize", label: "Size", color: "var(--chart-3)", kind: "area" }]}
                />
              </ChartBlock>
            )}
            {r.type === "SUPABASE_PROJECT" && range === "24h" && (
              <ChartBlock title="Connections (peak)">
                <TimeChart
                  data={s.metrics}
                  unit="count"
                  range={range}
                  series={[{ key: "connections", label: "Connections", color: "var(--chart-4)" }]}
                />
              </ChartBlock>
            )}
            {s.restarts && (
              <ChartBlock title="Restarts">
                <TimeChart
                  data={s.restarts}
                  unit="count"
                  range={range}
                  height={120}
                  yMax={Math.max(3, ...s.restarts.map((p) => p.restarts))}
                  series={[
                    {
                      key: "restarts",
                      label: "Restarts",
                      color: "var(--status-warning)",
                      kind: "bar",
                    },
                  ]}
                />
              </ChartBlock>
            )}
          </div>
        )}

        {s.health && (
          <div className="grid gap-5 lg:grid-cols-2">
            <ChartBlock title="Availability">
              <UptimeStrip points={s.health} />
              <p className="text-[11px] text-muted-foreground">
                Each segment is one period; hover for failures.
              </p>
            </ChartBlock>
            <ChartBlock title="Response time">
              <TimeChart
                data={s.health}
                unit="ms"
                range={range}
                height={140}
                series={[
                  { key: "avgMs", label: "Response", color: "var(--chart-1)", kind: "area" },
                ]}
              />
            </ChartBlock>
          </div>
        )}

        {s.functions && (
          <ChartBlock title="Invocations and errors">
            <TimeChart
              data={s.functions}
              unit="count"
              range={range === "24h" ? "7d" : range}
              height={160}
              series={[
                { key: "invocations", label: "Invocations", color: "var(--chart-1)", kind: "bar" },
                { key: "errors", label: "Errors", color: "var(--status-critical)", kind: "bar" },
              ]}
            />
            {range === "24h" && (
              <p className="text-[11px] text-muted-foreground">
                Stats are daily, so 24h shows the latest day.
              </p>
            )}
          </ChartBlock>
        )}

        {DEPLOYABLE.includes(r.type) && (
          <div className="space-y-2">
            <SectionLabel>Deployments · {RANGE_LABEL[range]}</SectionLabel>
            {s.deployments.length === 0 ? (
              <p className="text-xs text-muted-foreground">No deployments in this range.</p>
            ) : (
              <ul className="space-y-1.5">
                {s.deployments.slice(0, DEPLOYS_SHOWN).map((d) => (
                  <li key={d.id}>
                    <DeployLine deployment={d} now={now} />
                  </li>
                ))}
                {s.deployments.length > DEPLOYS_SHOWN && (
                  <li className="text-xs text-muted-foreground">
                    +{s.deployments.length - DEPLOYS_SHOWN} more in the Activity tab
                  </li>
                )}
              </ul>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
