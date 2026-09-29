import type * as React from "react";
import { cn } from "@/lib/utils";

export function SectionLabel({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <p
      className={cn(
        "font-display text-[10px] font-medium tracking-[0.22em] text-primary/80 uppercase",
        className,
      )}
    >
      {children}
    </p>
  );
}
