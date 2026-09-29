import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** A styled native <select>: works with FormData and needs no client JS. */
function NativeSelect({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <div className="relative">
      <select
        data-slot="native-select"
        className={cn(
          "flex h-9 w-full min-w-0 appearance-none rounded-md border border-input bg-background/60 py-1 pr-9 pl-3 text-base shadow-xs transition-[color,box-shadow] outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          "focus-visible:border-primary/70 focus-visible:shadow-[0_0_14px_-4px_var(--glow)] focus-visible:ring-[3px] focus-visible:ring-ring/30",
          "aria-invalid:border-destructive aria-invalid:ring-destructive/30",
          "[&>option]:bg-popover",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

export { NativeSelect };
