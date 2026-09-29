import { type Prisma } from "@prisma/client";
import { DAY_MS, isLondonWeekend } from "@jarvis/shared";
import { type SeedContext } from "../context";
import { createRng, seedFrom } from "../random";

type Volume = { weekday: [number, number]; weekend: [number, number]; errorRate: [number, number] };

/** One row per UTC day; today's row covers midnight until now. */
export function functionStats(
  ctx: SeedContext,
  resourceId: string,
  volume: Volume,
  seedLabel: string,
): Prisma.FunctionStatsCreateManyInput[] {
  const rng = createRng(seedFrom(seedLabel));
  const rows: Prisma.FunctionStatsCreateManyInput[] = [];
  const first = new Date(ctx.start);
  first.setUTCHours(0, 0, 0, 0);

  for (let day = first.getTime(); day < ctx.now.getTime(); day += DAY_MS) {
    const periodStart = new Date(day);
    const fullEnd = new Date(day + DAY_MS);
    const periodEnd = fullEnd > ctx.now ? ctx.now : fullEnd;
    const fraction = (periodEnd.getTime() - periodStart.getTime()) / DAY_MS;
    const [lo, hi] = isLondonWeekend(new Date(day + DAY_MS / 2)) ? volume.weekend : volume.weekday;
    const invocations = Math.round(rng.int(lo, hi) * fraction);
    const errors = Math.round(invocations * rng.float(volume.errorRate[0], volume.errorRate[1]));
    rows.push({ resourceId, periodStart, periodEnd, invocations, errors });
  }
  return rows;
}
