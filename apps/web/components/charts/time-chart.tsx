"use client";

import type { ChartRange } from "@jarvis/shared";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";

export type SeriesDef = {
  key: string;
  label: string;
  color: string;
  kind?: "line" | "area" | "bar";
  /** Faint band e.g. for the peak value behind an average line. */
  faint?: boolean;
};

export type ChartUnit = "percent" | "ms" | "bytes" | "count";

type Point = { t: number } & Record<string, number | null>;

const tzOpts = { timeZone: "Europe/London" } as const;
const timeFmt = new Intl.DateTimeFormat("en-GB", { ...tzOpts, hour: "2-digit", minute: "2-digit" });
const dayFmt = new Intl.DateTimeFormat("en-GB", { ...tzOpts, day: "numeric", month: "short" });
const fullFmt = new Intl.DateTimeFormat("en-GB", {
  ...tzOpts,
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

function formatValue(v: number, unit: ChartUnit): string {
  switch (unit) {
    case "percent":
      return `${v.toFixed(1)}%`;
    case "ms":
      return `${Math.round(v)} ms`;
    case "bytes": {
      const units = ["B", "KB", "MB", "GB", "TB"];
      let x = v;
      let i = 0;
      while (x >= 1024 && i < units.length - 1) {
        x /= 1024;
        i += 1;
      }
      return `${x.toFixed(i < 2 ? 0 : 2)} ${units[i]}`;
    }
    case "count":
      return v.toLocaleString("en-GB");
  }
}

function axisValue(v: number, unit: ChartUnit): string {
  if (unit === "percent") return `${v}%`;
  if (unit === "bytes") return formatValue(v, unit).replace(/\.\d+/, "");
  if (unit === "count" && v >= 1000) return `${Math.round(v / 100) / 10}k`;
  return String(v);
}

export function TimeChart({
  data,
  series,
  unit,
  range,
  height = 180,
  thresholds,
  yMax,
  className,
}: {
  data: Point[];
  series: SeriesDef[];
  unit: ChartUnit;
  range: ChartRange;
  height?: number;
  /** Draws warning/critical guide lines (percent charts). */
  thresholds?: { warning: number; critical: number };
  yMax?: number;
  className?: string;
}) {
  const hasData = data.some((p) => series.some((s) => p[s.key] !== null && p[s.key] !== undefined));
  if (!hasData) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-md border border-dashed border-border/70 text-xs text-status-nodata",
          className,
        )}
        style={{ height }}
      >
        No data in this range
      </div>
    );
  }

  const tickFormatter = (t: number) => (range === "24h" ? timeFmt.format(t) : dayFmt.format(t));

  return (
    <div className={cn("w-full", className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: -12 }}>
          <CartesianGrid stroke="var(--border)" strokeOpacity={0.5} vertical={false} />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={["dataMin", "dataMax"]}
            tickFormatter={tickFormatter}
            tick={{ fill: "var(--muted-foreground)", fontSize: 10, fontFamily: "var(--font-mono)" }}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
            minTickGap={32}
          />
          <YAxis
            domain={unit === "percent" ? [0, yMax ?? 100] : [0, yMax ?? "auto"]}
            tickFormatter={(v: number) => axisValue(v, unit)}
            tick={{ fill: "var(--muted-foreground)", fontSize: 10, fontFamily: "var(--font-mono)" }}
            tickLine={false}
            axisLine={false}
            width={unit === "bytes" ? 64 : 44}
            allowDecimals={false}
          />
          {thresholds && (
            <>
              <ReferenceLine
                y={thresholds.warning}
                stroke="var(--status-warning)"
                strokeDasharray="3 4"
                strokeOpacity={0.5}
              />
              <ReferenceLine
                y={thresholds.critical}
                stroke="var(--status-critical)"
                strokeDasharray="3 4"
                strokeOpacity={0.5}
              />
            </>
          )}
          <Tooltip
            cursor={{ stroke: "var(--primary)", strokeOpacity: 0.4 }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length || typeof label !== "number") return null;
              return (
                <div className="rounded-md border border-primary/30 bg-popover/95 px-3 py-2 text-xs shadow-[0_0_18px_-8px_var(--glow)]">
                  <p className="mb-1 font-mono text-muted-foreground">{fullFmt.format(label)}</p>
                  {payload.map((p) => {
                    const def = series.find((s) => s.key === p.dataKey);
                    if (!def || typeof p.value !== "number") return null;
                    return (
                      <p key={def.key} className="flex items-center gap-2">
                        <span className="size-2 rounded-full" style={{ background: def.color }} />
                        <span className="text-muted-foreground">{def.label}</span>
                        <span className="ml-auto font-mono">{formatValue(p.value, unit)}</span>
                      </p>
                    );
                  })}
                </div>
              );
            }}
          />
          {series.map((s) => {
            if (s.kind === "bar") {
              return (
                <Bar
                  key={s.key}
                  dataKey={s.key}
                  fill={s.color}
                  fillOpacity={s.faint ? 0.35 : 0.8}
                  radius={[2, 2, 0, 0]}
                  isAnimationActive={false}
                />
              );
            }
            if (s.kind === "area" || s.faint) {
              return (
                <Area
                  key={s.key}
                  dataKey={s.key}
                  type="monotone"
                  stroke={s.faint ? "none" : s.color}
                  fill={s.color}
                  fillOpacity={s.faint ? 0.12 : 0.18}
                  connectNulls={false}
                  isAnimationActive={false}
                  activeDot={false}
                />
              );
            }
            return (
              <Line
                key={s.key}
                dataKey={s.key}
                type="monotone"
                stroke={s.color}
                strokeWidth={1.5}
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
            );
          })}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
