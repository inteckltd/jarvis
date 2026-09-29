import { type Prisma } from "@prisma/client";
import { DAY_MS, HOUR_MS, londonDateOnly } from "@jarvis/shared";
import { ago, type SeedContext } from "../context";

type CommentSpec = {
  /** Omit for Inteck; otherwise a client contact's name. */
  contact?: string;
  hoursAgo: number;
  body: string;
};

type TaskSpec = {
  title: string;
  client: boolean;
  /** Due date offset in London calendar days from today (negative = past). */
  dueInDays: number;
  /** If set, the task was completed this many days ago. */
  completedDaysAgo?: number;
  description?: string;
  comments?: readonly CommentSpec[];
};

const CONTACT = "Sarah Mitchell";

const TASKS: readonly TaskSpec[] = [
  // Completed during the month (feeds "tasks completed" in reports).
  {
    title: "Add /health endpoint to workforce-api",
    client: true,
    dueInDays: -27,
    completedDaysAgo: 27,
    description:
      "Return 200 with { status, version } and check the database connection.\nUpdate the DO health check path afterwards.",
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
    description: "Line items are split across pages on long quotes. Keep each row together.",
    comments: [
      {
        contact: CONTACT,
        hoursAgo: 18 * 24,
        body: "Quote Q-10492 is a good example: the last three items end up on their own page.",
      },
      {
        hoursAgo: 17 * 24,
        body: "Thanks, reproduced. Fix is on staging now if you want to check it.",
      },
      { contact: CONTACT, hoursAgo: 16 * 24 - 3, body: "Looks good on staging 👍" },
    ],
  },
  { title: "Review edge function error logs", client: true, dueInDays: -9, completedDaysAgo: 9 },
  { title: "Upgrade Next.js on Web UI", client: true, dueInDays: -4, completedDaysAgo: 5 },
  // Overdue.
  {
    title: "Investigate html-pdf-api memory growth",
    client: true,
    dueInDays: -3,
    description:
      "Memory climbs ~2% a day between deploys and sits in the high 70s after a week.\nSuspect the Chromium page pool is not releasing pages on timeout.",
    comments: [
      {
        hoursAgo: 50,
        body: "Heap snapshot shows detached pages. Trying a max-age on pooled pages.",
      },
    ],
  },
  { title: "Add /health endpoint to html-pdf-api", client: true, dueInDays: -1 },
  // Today.
  {
    title: "Merge pre-production into main for workforce-api",
    client: true,
    dueInDays: 0,
    description: "Includes the timesheet export fix and the new shift templates.",
  },
  { title: "Check App Store review status for mobile 2.4.0", client: true, dueInDays: 0 },
  {
    title: "Reply to IDS about site notes feature",
    client: true,
    dueInDays: 0,
    description:
      "They want engineers to attach photos to site notes from the mobile app, visible in the web UI.",
    comments: [
      {
        contact: CONTACT,
        hoursAgo: 26,
        body: "Could engineers add photos to site notes? Ideally up to 5 per note, and we'd like to see them on the job page in the office.",
      },
      {
        hoursAgo: 22,
        body: "Definitely doable. I'll send over a rough estimate and how storage would work.",
      },
    ],
  },
  // Upcoming.
  { title: "Prepare IDS monthly report", client: true, dueInDays: 2 },
  { title: "Plan Supabase compute upgrade", client: true, dueInDays: 5 },
  { title: "Update Expo SDK in mobile app", client: true, dueInDays: 9 },
  // Internal.
  { title: "Pay DigitalOcean invoice", client: false, dueInDays: 1 },
  { title: "Renew Inteck professional indemnity insurance", client: false, dueInDays: 12 },
];

/** Used by clear-mock to find seeded tasks. */
export const SEEDED_TASK_TITLES: readonly string[] = TASKS.map((t) => t.title);

export function tasks(ctx: SeedContext, clientId: string): Prisma.TaskCreateInput[] {
  return TASKS.map((t) => {
    const dueDate = londonDateOnly(ctx.now, t.dueInDays);
    const completed = t.completedDaysAgo !== undefined;
    const earliestComment = Math.max(0, ...(t.comments ?? []).map((c) => c.hoursAgo));
    const createdAt = new Date(
      Math.min(
        dueDate.getTime() - 3 * DAY_MS,
        ctx.now.getTime() - HOUR_MS,
        ctx.now.getTime() - (earliestComment + 2) * HOUR_MS,
      ),
    );
    return {
      client: t.client ? { connect: { id: clientId } } : undefined,
      title: t.title,
      description: t.description ?? null,
      dueDate,
      completed,
      completedAt: completed ? ago(ctx, (t.completedDaysAgo ?? 0) * DAY_MS) : null,
      createdAt,
      comments: t.comments && {
        create: t.comments.map((c) => ({
          authorType: c.contact ? "CONTACT" : "INTECK",
          authorName: c.contact ?? "Inteck",
          body: c.body,
          createdAt: ago(ctx, c.hoursAgo * HOUR_MS),
        })),
      },
    };
  });
}
