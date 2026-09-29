import { formatLondonDateTime } from "@jarvis/shared";
import type { HealthPoint } from "@/lib/client-charts";
import { cn } from "@/lib/utils";

function tone(p: HealthPoint): string {
  if (p.uptime === null) return "bg-status-nodata/25";
  if (p.uptime >= 100) return "bg-status-healthy/70";
  if (p.uptime >= 95) return "bg-status-warning/80";
  return "bg-status-critical/85";
}

/** One segment per health bucket: green all up, amber brief failures, red mostly down, grey no checks. */
export function UptimeStrip({ points, className }: { points: HealthPoint[]; className?: string }) {
  return (
    <div
      className={cn("flex h-5 w-full gap-px", className)}
      role="img"
      aria-label="Uptime by period"
    >
      {points.map((p) => (
        <span
          key={p.t}
          className={cn("min-w-px flex-1 rounded-[1px]", tone(p))}
          title={`${formatLondonDateTime(new Date(p.t))} · ${
            p.uptime === null ? "no checks" : `${p.uptime}% up (${p.total - p.up} failed)`
          }`}
        />
      ))}
    </div>
  );
}
