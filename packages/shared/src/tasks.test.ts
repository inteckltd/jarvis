import { describe, expect, it } from "vitest";
import {
  dateOnlyKey,
  daysUntil,
  formatDueDate,
  parseDateOnly,
  taskBucket,
  taskInputSchema,
} from "./tasks";

// 23:30 BST on 29 Sep is still 29 Sep in London but 22:30 UTC.
const lateEvening = new Date("2026-09-29T22:30:00Z");
// 00:30 BST on 30 Sep is 23:30 UTC on 29 Sep.
const justAfterMidnight = new Date("2026-09-29T23:30:00Z");

describe("parseDateOnly", () => {
  it("stores noon UTC on the given day", () => {
    expect(parseDateOnly("2026-09-29")?.toISOString()).toBe("2026-09-29T12:00:00.000Z");
  });

  it("rejects malformed and impossible dates", () => {
    expect(parseDateOnly("29/09/2026")).toBeNull();
    expect(parseDateOnly("2026-02-30")).toBeNull();
    expect(parseDateOnly("")).toBeNull();
  });

  it("round-trips through dateOnlyKey", () => {
    const d = parseDateOnly("2026-03-29");
    expect(d && dateOnlyKey(d)).toBe("2026-03-29");
  });
});

describe("taskBucket", () => {
  const due = (key: string) => {
    const d = parseDateOnly(key);
    if (!d) throw new Error(key);
    return d;
  };

  it("buckets by London calendar day", () => {
    expect(taskBucket(due("2026-09-28"), lateEvening)).toBe("overdue");
    expect(taskBucket(due("2026-09-29"), lateEvening)).toBe("today");
    expect(taskBucket(due("2026-09-30"), lateEvening)).toBe("upcoming");
  });

  it("rolls over at London midnight, not UTC midnight", () => {
    expect(taskBucket(due("2026-09-29"), justAfterMidnight)).toBe("overdue");
    expect(taskBucket(due("2026-09-30"), justAfterMidnight)).toBe("today");
  });

  it("counts whole days across the clock change", () => {
    const now = new Date("2026-10-24T10:00:00Z");
    expect(daysUntil(due("2026-10-26"), now)).toBe(2);
  });
});

describe("formatDueDate", () => {
  const now = new Date("2026-09-29T09:00:00Z");
  const f = (key: string, completed = false) => {
    const d = parseDateOnly(key);
    if (!d) throw new Error(key);
    return formatDueDate(d, now, completed);
  };

  it("uses relative words near today", () => {
    expect(f("2026-09-29")).toBe("Today");
    expect(f("2026-09-30")).toBe("Tomorrow");
    expect(f("2026-09-28")).toBe("Yesterday · overdue");
    expect(f("2026-09-26")).toBe("3 days overdue");
  });

  it("does not call completed tasks overdue", () => {
    expect(f("2026-09-26", true)).toBe("Sat 26 Sept");
    expect(f("2026-09-28", true)).toBe("Yesterday");
  });

  it("shows the year for far-off dates", () => {
    expect(f("2027-10-02")).toBe("2 Oct 2027");
  });
});

describe("taskInputSchema", () => {
  it("parses a quick-add", () => {
    const r = taskInputSchema.parse({
      title: "  Renew SSL ",
      clientId: "",
      dueDate: "2026-10-01",
      description: "",
    });
    expect(r).toEqual({
      title: "Renew SSL",
      clientId: null,
      dueDate: new Date("2026-10-01T12:00:00Z"),
      description: null,
    });
  });

  it("reports field errors", () => {
    const r = taskInputSchema.safeParse({
      title: "",
      clientId: "",
      dueDate: "2026-13-01",
      description: "",
    });
    expect(r.success).toBe(false);
    const paths = r.error?.issues.map((i) => i.path.join("."));
    expect(paths).toEqual(expect.arrayContaining(["title", "dueDate"]));
  });
});
