import { cn } from "@/lib/utils";

/** Tiny trend line for 0–100% series. Renders nothing useful with fewer than 2 points. */
export function Sparkline({
  values,
  label,
  className,
  max = 100,
}: {
  values: readonly number[];
  label: string;
  className?: string;
  max?: number;
}) {
  const w = 100;
  const h = 24;
  if (values.length < 2) {
    return (
      <div
        className={cn("flex h-6 items-center text-[10px] text-status-nodata", className)}
        aria-label={`${label}: no trend data`}
      >
        no trend
      </div>
    );
  }
  const step = w / (values.length - 1);
  const points = values.map((v, i) => {
    const y = h - (Math.min(max, Math.max(0, v)) / max) * (h - 2) - 1;
    return `${(i * step).toFixed(2)},${y.toFixed(2)}`;
  });
  const line = `M${points.join(" L")}`;
  const area = `${line} L${w},${h} L0,${h} Z`;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className={cn("h-6 w-full text-primary", className)}
      role="img"
      aria-label={`${label}, last 24 hours`}
    >
      <path d={area} fill="currentColor" className="opacity-10" />
      <path
        d={line}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
      />
    </svg>
  );
}
