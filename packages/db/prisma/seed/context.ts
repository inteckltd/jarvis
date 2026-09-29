import { DAY_MS } from "@jarvis/shared";
import { floorToMinutes } from "./time";

export const SCENARIOS = ["amber", "healthy", "red"] as const;
export type Scenario = (typeof SCENARIOS)[number];

export type SeedContext = {
  now: Date;
  start: Date;
  scenario: Scenario;
};

export function createContext(scenario: Scenario, days = 30): SeedContext {
  const now = floorToMinutes(new Date(), 1);
  return { now, start: new Date(floorToMinutes(now, 15).getTime() - days * DAY_MS), scenario };
}

export function ago(ctx: SeedContext, ms: number): Date {
  return new Date(ctx.now.getTime() - ms);
}
