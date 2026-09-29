import { type Prisma } from "@prisma/client";
import { HOUR_MS, MINUTE_MS } from "@jarvis/shared";
import { ago, type SeedContext } from "../context";
import { clamp, createRng, seedFrom } from "../random";
import { floorToMinutes, timeline, workload } from "../time";

export type HealthRow = Prisma.HealthCheckCreateManyInput;

export type Outage = { from: Date; to: Date };

export type HealthProfile = {
  /** Typical response time in ms. */
  baseMs: number;
  /** Probability that any single check fails (random blip). */
  blipRate: number;
  outages: readonly Outage[];
};

/** Every 5 minutes for the month, every minute for the last 2 hours. */
export function healthTimeline(ctx: SeedContext): Date[] {
  const recent = floorToMinutes(ago(ctx, 2 * HOUR_MS), 5);
  const end = new Date(ctx.now.getTime() + 1);
  return [...timeline(ctx.start, recent, 5), ...timeline(recent, end, 1)];
}

export function healthChecks(
  ctx: SeedContext,
  resourceId: string,
  profile: HealthProfile,
  seedLabel: string,
): HealthRow[] {
  const rng = createRng(seedFrom(seedLabel));
  const rows: HealthRow[] = [];

  for (const t of healthTimeline(ctx)) {
    const inOutage = profile.outages.some((o) => t >= o.from && t <= o.to);
    const blip = !inOutage && rng.chance(profile.blipRate);

    if (inOutage || blip) {
      const timeout = rng.chance(0.5);
      rows.push({
        resourceId,
        isUp: false,
        statusCode: timeout ? null : rng.pick([502, 503, 504]),
        responseMs: timeout ? null : rng.int(20, 200),
        checkedAt: t,
      });
      continue;
    }

    // Log-normal-ish latency with a small working-hours penalty and an occasional long tail.
    const tail = rng.chance(0.01) ? rng.float(2, 5) : 1;
    const ms = profile.baseMs * Math.exp(rng.gaussian(0, 0.25)) * (1 + 0.3 * workload(t)) * tail;
    rows.push({
      resourceId,
      isUp: true,
      statusCode: 200,
      responseMs: Math.round(clamp(ms, 20, 10_000)),
      checkedAt: t,
    });
  }
  return rows;
}

export function outage(ctx: SeedContext, startAgoMs: number, durationMinutes: number): Outage {
  const from = ago(ctx, startAgoMs);
  return { from, to: new Date(from.getTime() + durationMinutes * MINUTE_MS) };
}
