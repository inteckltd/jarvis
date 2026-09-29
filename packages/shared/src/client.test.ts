import { describe, expect, it } from "vitest";
import { clientInitials, clientInputSchema, slugify } from "./client";

const valid = {
  name: "Industrial Door Systems",
  slug: "ids",
  logoUrl: "",
  contactName: "",
  contactEmail: "",
  notes: "",
  active: true,
};

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Industrial Door Systems")).toBe("industrial-door-systems");
  });
  it("strips accents, symbols and edge hyphens", () => {
    expect(slugify("  Café & Co. (UK)  ")).toBe("cafe-and-co-uk");
  });
  it("limits length without a trailing hyphen", () => {
    const slug = slugify(`${"a".repeat(47)} b`);
    expect(slug.length).toBeLessThanOrEqual(48);
    expect(slug.endsWith("-")).toBe(false);
  });
});

describe("clientInputSchema", () => {
  it("accepts a minimal client and nulls empty optionals", () => {
    const parsed = clientInputSchema.parse(valid);
    expect(parsed).toMatchObject({
      logoUrl: null,
      contactName: null,
      contactEmail: null,
      notes: null,
    });
  });

  it("normalises email and trims text", () => {
    const parsed = clientInputSchema.parse({
      ...valid,
      contactEmail: " Ops@IDS.Example ",
      name: "  IDS  ",
    });
    expect(parsed.contactEmail).toBe("ops@ids.example");
    expect(parsed.name).toBe("IDS");
  });

  it("lowercases the slug", () => {
    expect(clientInputSchema.parse({ ...valid, slug: "IDS" }).slug).toBe("ids");
  });

  it.each([
    ["spaces", "i d s"],
    ["double hyphen", "a--b"],
    ["leading hyphen", "-ids"],
    ["too short", "a"],
    ["reserved", "new"],
  ])("rejects slug with %s", (_label, slug) => {
    expect(clientInputSchema.safeParse({ ...valid, slug }).success).toBe(false);
  });

  it("rejects a bad email and a non-http logo URL", () => {
    expect(clientInputSchema.safeParse({ ...valid, contactEmail: "nope" }).success).toBe(false);
    expect(clientInputSchema.safeParse({ ...valid, logoUrl: "javascript:alert(1)" }).success).toBe(
      false,
    );
  });
});

describe("clientInitials", () => {
  it("uses up to three initials", () => {
    expect(clientInitials("Industrial Door Systems")).toBe("IDS");
    expect(clientInitials("a b c d")).toBe("ABC");
    expect(clientInitials("   ")).toBe("?");
  });
});
