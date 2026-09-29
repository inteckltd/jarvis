import type * as React from "react";
import { cn } from "@/lib/utils";
import { MetricValue } from "./metric-value";

/** Small labelled number used in summary grids. */
export function Stat({
  label,
  value,
  hint,
  className,
}: {
  label: string;
  value: number | null;
  hint?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <span className="text-[11px] tracking-wider text-muted-foreground uppercase">{label}</span>
      <MetricValue value={value} />
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  );
}
