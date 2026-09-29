import { type Prisma } from "@prisma/client";
import { DAY_MS, HOUR_MS, londonDateOnly } from "@jarvis/shared";
import { ago, type SeedContext } from "../context";

type TaskSpec = {
  title: string;
  client: boolean;
  /** Due date offset in London calendar days from today (negative = past). */
  dueInDays: number;
  /** If set, the task was completed this many days ago. */
  completedDaysAgo?: number;
};

const TASKS: readonly TaskSpec[] = [
  // Completed during the month (feeds "tasks completed" in reports).
  {
    title: "Add /health endpoint to workforce-api",
    client: true,
    dueInDays: -27,
    completedDaysAgo: 27,
  },
  { title: "Rotate Supabase service role key", client: true, dueInDays: -22, completedDaysAgo: 23 },
  {
    title: "Release mobile app 2.3.1 to App Store",
    client: true,
    dueInDays: -25,
    completedDaysAgo: 24,
  },
  {
    title: "Fix PDF page breaks in quote template",
    client: true,
    dueInDays: -16,
    completedDaysAgo: 15,
  },
  { title: "Review edge function error logs", client: true, dueInDays: -9, completedDaysAgo: 9 },
  { title: "Upgrade Next.js on Web UI", client: true, dueInDays: -4, completedDaysAgo: 5 },
  // Overdue.
  { title: "Investigate html-pdf-api memory growth", client: true, dueInDays: -3 },
  { title: "Add /health endpoint to html-pdf-api", client: true, dueInDays: -1 },
  // Today.
  { title: "Merge pre-production into main for workforce-api", client: true, dueInDays: 0 },
  { title: "Check App Store review status for mobile 2.4.0", client: true, dueInDays: 0 },
  { title: "Reply to IDS about site notes feature", client: true, dueInDays: 0 },
  // Upcoming.
  { title: "Prepare IDS monthly report", client: true, dueInDays: 2 },
  { title: "Plan Supabase compute upgrade", client: true, dueInDays: 5 },
  { title: "Update Expo SDK in mobile app", client: true, dueInDays: 9 },
  // Internal.
  { title: "Pay DigitalOcean invoice", client: false, dueInDays: 1 },
  { title: "Renew Inteck professional indemnity insurance", client: false, dueInDays: 12 },
];

export function tasks(ctx: SeedContext, clientId: string): Prisma.TaskCreateManyInput[] {
  return TASKS.map((t) => {
    const dueDate = londonDateOnly(ctx.now, t.dueInDays);
    const completed = t.completedDaysAgo !== undefined;
    const createdAt = new Date(
      Math.min(dueDate.getTime() - 3 * DAY_MS, ctx.now.getTime() - HOUR_MS),
    );
    return {
      clientId: t.client ? clientId : null,
      title: t.title,
      dueDate,
      completed,
      completedAt: completed ? ago(ctx, (t.completedDaysAgo ?? 0) * DAY_MS) : null,
      createdAt,
    };
  });
}
