import { z } from "zod";
import { TIMEZONE } from "./constants";
import { londonDateOnly, londonDayKey } from "./time";

export const TASK_BUCKETS = ["overdue", "today", "upcoming"] as const;
export type TaskBucket = (typeof TASK_BUCKETS)[number];

export const TASK_VIEWS = ["open", ...TASK_BUCKETS, "completed"] as const;
export type TaskView = (typeof TASK_VIEWS)[number];

export function isTaskView(value: unknown): value is TaskView {
  return typeof value === "string" && (TASK_VIEWS as readonly string[]).includes(value);
}

const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** "2026-09-29" -> stored date-only value (12:00 UTC on that day), or null if invalid. */
export function parseDateOnly(key: string): Date | null {
  const m = DATE_KEY.exec(key);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) {
    return null;
  }
  return date;
}

/** Whole London calendar days from today to `dueDate` (negative = overdue). */
export function daysUntil(dueDate: Date, now: Date = new Date()): number {
  const today = londonDateOnly(now).getTime();
  const due = londonDateOnly(dueDate).getTime();
  return Math.round((due - today) / 86_400_000);
}

export function taskBucket(dueDate: Date, now: Date = new Date()): TaskBucket {
  const days = daysUntil(dueDate, now);
  if (days < 0) return "overdue";
  if (days === 0) return "today";
  return "upcoming";
}

const dueFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIMEZONE,
  weekday: "short",
  day: "numeric",
  month: "short",
});

const dueFmtYear = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIMEZONE,
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** "Today", "Tomorrow", "Yesterday", "3 days overdue", "Fri 2 Oct", "2 Oct 2027". */
export function formatDueDate(dueDate: Date, now: Date = new Date(), completed = false): string {
  const days = daysUntil(dueDate, now);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return completed ? "Yesterday" : "Yesterday · overdue";
  if (days < 0 && !completed) return `${-days} days overdue`;
  if (Math.abs(days) <= 180) return dueFmt.format(dueDate).replace(",", "");
  return dueFmtYear.format(dueDate);
}

/** Value for <input type="date">. */
export function dateOnlyKey(date: Date): string {
  return londonDayKey(date);
}

// --- Inputs ------------------------------------------------------------------

export const taskInputSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200, "Must be 200 characters or fewer"),
  /** null = internal (Inteck) task. */
  clientId: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v)),
  dueDate: z
    .string()
    .trim()
    .min(1, "Pick a due date")
    .transform((v, ctx) => {
      const date = parseDateOnly(v);
      if (!date) {
        ctx.addIssue({ code: "custom", message: "Enter a valid date" });
        return z.NEVER;
      }
      return date;
    }),
  description: z
    .string()
    .trim()
    .max(10_000, "Must be 10,000 characters or fewer")
    .transform((v) => (v === "" ? null : v)),
});
export type TaskInput = z.output<typeof taskInputSchema>;

export const taskCommentSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "Write a comment first")
    .max(5_000, "Must be 5,000 characters or fewer"),
});
