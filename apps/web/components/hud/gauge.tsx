import type { HealthStatus } from "@jarvis/shared";
import { cn } from "@/lib/utils";

const STROKE: Record<HealthStatus, string> = {
  healthy: "text-status-healthy",
  warning: "text-status-warning",
  critical: "text-status-critical",
  nodata: "text-status-nodata",
};

/** Fraction of the circle used by the dial (270°, open at the bottom). */
const SWEEP = 0.75;

/**
 * Circular HUD gauge for a percentage. null = no data (grey dash);
 * notApplicable = neutral "N/A" (e.g. disk on App Platform), never an error colour.
 */
export function Gauge({
  label,
  value,
  status,
  notApplicable = false,
  stale = false,
  size = 76,
  className,
}: {
  label: string;
  value: number | null;
  status: HealthStatus;
  notApplicable?: boolean;
  /** Last known value is old: shown, but faded and grey. */
  stale?: boolean;
  size?: number;
  className?: string;
}) {
  const r = 40;
  const circumference = 2 * Math.PI * r;
  const track = circumference * SWEEP;
  const pct = value === null || notApplicable ? 0 : Math.min(100, Math.max(0, value));
  const tone = notApplicable ? "text-status-na" : stale ? "text-status-nodata" : STROKE[status];
  const display = notApplicable ? "N/A" : value === null ? "—" : `${Math.round(value)}`;

  return (
    <figure
      className={cn("flex flex-col items-center gap-1", stale && "opacity-60", className)}
      aria-label={`${label}: ${notApplicable ? "not applicable" : value === null ? "no data" : `${Math.round(value)}%`}`}
    >
      <div className="relative" style={{ width: size, height: size }}>
        <svg viewBox="0 0 100 100" className="size-full -rotate-[225deg]" aria-hidden>
          <circle
            cx="50"
            cy="50"
            r={r}
            fill="none"
            strokeWidth="7"
            strokeLinecap="round"
            className="stroke-border"
            strokeDasharray={`${track} ${circumference}`}
          />
          {pct > 0 && (
            <circle
              cx="50"
              cy="50"
              r={r}
              fill="none"
              strokeWidth="7"
              strokeLinecap="round"
              stroke="currentColor"
              className={cn(
                tone,
                "drop-shadow-[0_0_4px_currentColor] transition-[stroke-dasharray]",
              )}
              strokeDasharray={`${(track * pct) / 100} ${circumference}`}
            />
          )}
        </svg>
        <span
          className={cn(
            "absolute inset-0 flex items-center justify-center font-mono text-base font-medium tabular-nums",
            notApplicable ? "text-sm text-status-na" : value === null && "text-status-nodata",
          )}
        >
          {display}
          {!notApplicable && value !== null && (
            <span className="text-[0.6em] text-muted-foreground">%</span>
          )}
        </span>
      </div>
      <figcaption className="text-[10px] tracking-wider text-muted-foreground uppercase">
        {label}
      </figcaption>
    </figure>
  );
}
