import { HEALTH_STATUS_LABEL, type HealthStatus } from "@jarvis/shared";
import { cn } from "@/lib/utils";

const COLOR: Record<HealthStatus, string> = {
  healthy: "bg-status-healthy shadow-[0_0_8px_var(--status-healthy)]",
  warning: "bg-status-warning shadow-[0_0_8px_var(--status-warning)]",
  critical: "bg-status-critical shadow-[0_0_10px_var(--status-critical)]",
  nodata: "bg-status-nodata",
};

/** Coloured status indicator. Pulses only for warning / critical. */
export function StatusDot({ status, className }: { status: HealthStatus; className?: string }) {
  const pulse = status === "warning" || status === "critical";
  return (
    <span
      className={cn("relative inline-flex size-2.5 shrink-0", className)}
      role="img"
      aria-label={HEALTH_STATUS_LABEL[status]}
    >
      {pulse && (
        <span
          className={cn(
            "absolute inset-0 rounded-full opacity-60 motion-safe:animate-ping",
            COLOR[status],
          )}
        />
      )}
      <span className={cn("relative inline-flex size-2.5 rounded-full", COLOR[status])} />
    </span>
  );
}
