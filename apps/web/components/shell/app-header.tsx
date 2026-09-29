import { BRIEFING_GREETING } from "@jarvis/shared";
import { BriefingClock } from "./briefing-clock";

export function AppHeader() {
  return (
    <header className="flex flex-col gap-2 border-b border-border/60 pb-6">
      <h1 className="text-2xl font-semibold tracking-tight hud-glow-text md:text-3xl">
        {BRIEFING_GREETING}
      </h1>
      <BriefingClock initialIso={new Date().toISOString()} />
    </header>
  );
}
