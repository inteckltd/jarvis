"use client";

import { formatLondonDate, formatLondonTime } from "@jarvis/shared";
import { useEffect, useState } from "react";

/** Live Europe/London date and time. The server renders the initial value to avoid layout shift. */
export function BriefingClock({ initialIso }: { initialIso: string }) {
  const [now, setNow] = useState(() => new Date(initialIso));

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(id);
  }, []);

  return (
    <p className="flex flex-wrap items-baseline gap-x-3 text-sm text-muted-foreground">
      <span>{formatLondonDate(now)}</span>
      <span className="font-mono text-base text-primary tabular-nums hud-glow-text">
        {formatLondonTime(now)}
      </span>
      <span className="font-mono text-[10px] tracking-widest uppercase">Europe/London</span>
    </p>
  );
}
