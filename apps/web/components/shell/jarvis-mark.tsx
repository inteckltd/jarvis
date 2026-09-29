import { cn } from "@/lib/utils";

/** Arc-reactor style mark + wordmark. */
export function JarvisMark({
  className,
  showWordmark = true,
}: {
  className?: string;
  showWordmark?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <svg
        viewBox="0 0 32 32"
        className="size-7 text-primary drop-shadow-[0_0_6px_var(--glow)]"
        aria-hidden
      >
        <circle
          cx="16"
          cy="16"
          r="14"
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.35"
          strokeWidth="1"
        />
        <circle
          cx="16"
          cy="16"
          r="10"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeDasharray="4 3"
          className="origin-center motion-safe:animate-[spin_24s_linear_infinite]"
        />
        <circle cx="16" cy="16" r="4.5" fill="currentColor" fillOpacity="0.9" />
      </svg>
      {showWordmark && (
        <span className="font-display text-sm font-semibold tracking-[0.35em] text-primary hud-glow-text">
          JARVIS
        </span>
      )}
    </span>
  );
}
