import type * as React from "react";
import { cn } from "@/lib/utils";
import { SectionLabel } from "./section-label";

type HudPanelProps = {
  /** Small uppercase label above the title, e.g. "System link". */
  label?: string;
  title?: React.ReactNode;
  actions?: React.ReactNode;
  /** "muted" is for secondary content such as development environments. */
  tone?: "default" | "muted";
  corners?: boolean;
  /** Very subtle sweeping scanline (hidden for reduced motion). */
  scanline?: boolean;
  className?: string;
  contentClassName?: string;
  children?: React.ReactNode;
};

export function HudPanel({
  label,
  title,
  actions,
  tone = "default",
  corners = true,
  scanline = false,
  className,
  contentClassName,
  children,
}: HudPanelProps) {
  const hasHeader = Boolean(label ?? title ?? actions);
  return (
    <section
      className={cn(
        "relative animate-hud-fade-in rounded-lg backdrop-blur-sm",
        tone === "default" ? "bg-card hud-border" : "border border-border/60 bg-card/40 opacity-90",
        corners && tone === "default" && "hud-corners",
        className,
      )}
    >
      {scanline && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-lg motion-reduce:hidden"
        >
          <span className="absolute inset-x-0 top-0 h-full animate-hud-scan bg-linear-to-b from-transparent via-primary/5 to-transparent" />
        </span>
      )}
      {hasHeader && (
        <header className="flex items-start justify-between gap-4 border-b border-border/70 px-5 py-3">
          <div className="min-w-0 space-y-1">
            {label && <SectionLabel>{label}</SectionLabel>}
            {title && <h2 className="truncate text-base font-semibold tracking-tight">{title}</h2>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn("px-5 py-4", contentClassName)}>{children}</div>
    </section>
  );
}
