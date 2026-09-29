import { cn } from "@/lib/utils";

type MetricValueProps = {
  value: number | null;
  unit?: string;
  /** Metric does not apply to this resource (e.g. disk on DO App Platform): neutral "N/A". */
  notApplicable?: boolean;
  decimals?: number;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const SIZE = { sm: "text-sm", md: "text-2xl", lg: "text-4xl" } as const;

/** Monospace number with unit. null = no data (grey dash); notApplicable = neutral "N/A". */
export function MetricValue({
  value,
  unit,
  notApplicable,
  decimals = 0,
  size = "md",
  className,
}: MetricValueProps) {
  if (notApplicable) {
    return (
      <span className={cn("font-mono text-status-na tabular-nums", SIZE[size], className)}>
        N/A
      </span>
    );
  }
  if (value === null) {
    return (
      <span className={cn("font-mono text-status-nodata tabular-nums", SIZE[size], className)}>
        —
      </span>
    );
  }
  return (
    <span className={cn("font-mono font-medium tabular-nums", SIZE[size], className)}>
      {value.toLocaleString("en-GB", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {unit && <span className="ml-0.5 text-[0.55em] text-muted-foreground">{unit}</span>}
    </span>
  );
}
