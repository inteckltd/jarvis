import { describe, expect, it } from "vitest";
import { formatAgo, formatBytes, formatCount } from "./format";

const now = new Date("2026-09-29T08:00:00Z");
const ago = (ms: number) => new Date(now.getTime() - ms);

describe("formatAgo", () => {
  it("picks a sensible unit", () => {
    expect(formatAgo(ago(20_000), now)).toBe("just now");
    expect(formatAgo(ago(12 * 60_000), now)).toBe("12 min ago");
    expect(formatAgo(ago(3 * 3_600_000 + 60_000), now)).toBe("3h ago");
    expect(formatAgo(ago(26 * 3_600_000), now)).toBe("1 day ago");
    expect(formatAgo(ago(5 * 86_400_000), now)).toBe("5 days ago");
  });
});

describe("formatBytes", () => {
  it("uses binary units", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(156 * 1024 ** 2)).toBe("156.0 MB");
    expect(formatBytes(1.34 * 1024 ** 3)).toBe("1.3 GB");
  });
});

describe("formatCount", () => {
  it("abbreviates thousands", () => {
    expect(formatCount(950)).toBe("950");
    expect(formatCount(4_230)).toBe("4.2k");
    expect(formatCount(48_900)).toBe("49k");
    expect(formatCount(2_400_000)).toBe("2.4M");
  });
});
