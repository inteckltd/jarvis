import {
  DISK_NOT_APPLICABLE,
  formatAgo,
  formatBytes,
  formatCount,
  type HealthStatus,
  METRIC_TYPES,
} from "@jarvis/shared";
import Link from "next/link";
import type * as React from "react";
import { Gauge } from "@/components/hud/gauge";
import { MetricValue } from "@/components/hud/metric-value";
import { Sparkline } from "@/components/hud/sparkline";
import { StatusDot } from "@/components/hud/status-dot";
import type { ResourceView } from "@/lib/dashboard";
import { SHORT_TYPE_LABEL } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { DeployLine } from "./deploy-line";

const REASON_TEXT: Record<HealthStatus, string> = {
  critical: "text-status-critical",
  warning: "text-status-warning",
  healthy: "text-status-healthy",
  nodata: "text-status-nodata",
};

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] tracking-wider text-muted-foreground uppercase">{label}</span>
      <span className="font-mono text-sm tabular-nums">{children}</span>
    </div>
  );
}

function Uptime({ value }: { value: number | null }) {
  if (value === null) return <span className="text-status-nodata">—</span>;
  const tone =
    value >= 99.9
      ? "text-status-healthy"
      : value >= 99
        ? "text-status-warning"
        : "text-status-critical";
  return <span className={tone}>{value.toFixed(value === 100 ? 0 : 2)}%</span>;
}

/** One production resource on a client card. */
export function ResourceTile({
  resource: r,
  clientSlug,
  now,
}: {
  resource: ResourceView;
  clientSlug: string;
  now: Date;
}) {
  const e = r.evaluation;
  const hasMetrics = METRIC_TYPES.includes(r.type);
  const stale = hasMetrics && !e.metricsFresh;
  const facts: React.ReactNode[] = [];

  if (e.health !== null) {
    facts.push(
      <Fact key="up24" label="Uptime 24h">
        <Uptime value={r.uptime24h} />
      </Fact>,
      <Fact key="up30" label="30d">
        <Uptime value={r.uptime30d} />
      </Fact>,
    );
    if (r.responseMs !== null && e.health === "healthy") {
      facts.push(
        <Fact key="rt" label="Response">
          {r.responseMs}
          <span className="text-muted-foreground">ms</span>
        </Fact>,
      );
    }
  }
  if (e.restarts !== null) {
    facts.push(
      <Fact key="restarts" label="Restarts 24h">
        <span
          className={cn(
            e.restarts === "warning" && "text-status-warning",
            e.restarts === "critical" && "text-status-critical",
          )}
        >
          {r.restarts24h ?? "—"}
        </span>
      </Fact>,
    );
  }
  if (r.type === "SUPABASE_PROJECT" && r.metrics) {
    facts.push(
      <Fact key="conn" label="Connections">
        <MetricValue value={r.metrics.dbConnections} size="sm" />
      </Fact>,
      <Fact key="size" label="DB size">
        {r.metrics.dbSizeBytes === null ? "—" : formatBytes(r.metrics.dbSizeBytes)}
      </Fact>,
    );
  }
  if (r.type === "SUPABASE_FUNCTIONS") {
    facts.push(
      <Fact key="inv" label="Invocations 24h">
        {r.functions24h ? (
          formatCount(r.functions24h.invocations)
        ) : (
          <span className="text-status-na">N/A</span>
        )}
      </Fact>,
      <Fact key="err" label="Errors">
        {r.functions24h ? (
          <>
            {formatCount(r.functions24h.errors)}
            {r.functions24h.invocations > 0 && (
              <span className="text-muted-foreground">
                {" "}
                ({((r.functions24h.errors / r.functions24h.invocations) * 100).toFixed(1)}%)
              </span>
            )}
          </>
        ) : (
          <span className="text-status-na">N/A</span>
        )}
      </Fact>,
    );
  }

  return (
    <article
      className={cn(
        "flex flex-col gap-3 rounded-md border bg-background/40 p-4",
        e.status === "critical"
          ? "border-status-critical/50 shadow-[0_0_18px_-10px_var(--status-critical)]"
          : e.status === "warning"
            ? "border-status-warning/40"
            : "border-border/70",
      )}
    >
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link
            href={`/clients/${clientSlug}/resources/${r.id}`}
            className="flex items-center gap-2 font-medium hover:text-primary"
          >
            <StatusDot status={e.status} />
            <span className="truncate">{r.name}</span>
          </Link>
          <p className="mt-0.5 pl-4.5 text-[11px] text-muted-foreground">
            {SHORT_TYPE_LABEL[r.type]}
          </p>
        </div>
        {r.metrics && hasMetrics && (
          <time
            dateTime={r.metrics.capturedAt.toISOString()}
            className={cn(
              "shrink-0 font-mono text-[10px]",
              stale ? "text-status-nodata" : "text-muted-foreground",
            )}
            title="Latest metric sample"
          >
            {formatAgo(r.metrics.capturedAt, now)}
          </time>
        )}
      </header>

      {hasMetrics && (
        <div className="flex items-start justify-around gap-2">
          <Gauge label="CPU" value={r.metrics?.cpuPercent ?? null} status={e.cpu} stale={stale} />
          <Gauge
            label="Memory"
            value={r.metrics?.memoryPercent ?? null}
            status={e.memory}
            stale={stale}
          />
          <Gauge
            label="Disk"
            value={r.metrics?.diskPercent ?? null}
            status={e.disk ?? "nodata"}
            notApplicable={DISK_NOT_APPLICABLE.includes(r.type)}
            stale={stale}
          />
        </div>
      )}

      {hasMetrics && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className="text-[10px] tracking-wider text-muted-foreground uppercase">
              CPU 24h
            </span>
            <Sparkline values={r.spark.cpu} label="CPU" />
          </div>
          <div>
            <span className="text-[10px] tracking-wider text-muted-foreground uppercase">
              Memory 24h
            </span>
            <Sparkline values={r.spark.memory} label="Memory" className="text-chart-2" />
          </div>
        </div>
      )}

      {facts.length > 0 && <div className="flex flex-wrap gap-x-5 gap-y-2">{facts}</div>}

      {r.latestDeployment && (
        <DeployLine
          deployment={r.latestDeployment}
          now={now}
          className="border-t border-border/60 pt-2.5"
        />
      )}

      {e.reasons.length > 0 && (
        <ul className="space-y-0.5 text-xs">
          {e.reasons.map((reason) => (
            <li key={reason.message} className={REASON_TEXT[reason.status]}>
              {reason.message}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
