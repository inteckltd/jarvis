import { z } from "zod";

/** Slugs that would collide with static routes under /clients. */
export const RESERVED_CLIENT_SLUGS = ["new", "edit"] as const;

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** "Industrial Door Systems" -> "industrial-door-systems" */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "");
}

/** Trimmed text; empty becomes null. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Must be ${max} characters or fewer`)
    .transform((v) => (v === "" ? null : v));

export const clientInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120, "Must be 120 characters or fewer"),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2, "Slug must be at least 2 characters")
    .max(48, "Slug must be 48 characters or fewer")
    .regex(SLUG_PATTERN, "Use lowercase letters, numbers and single hyphens")
    .refine(
      (v) => !(RESERVED_CLIENT_SLUGS as readonly string[]).includes(v),
      "This slug is reserved",
    ),
  logoUrl: z
    .string()
    .trim()
    .max(2048)
    .refine((v) => v === "" || /^https?:\/\/\S+$/i.test(v), "Enter a full http(s) URL")
    .transform((v) => (v === "" ? null : v)),
  contactName: optionalText(120),
  contactEmail: z
    .string()
    .trim()
    .toLowerCase()
    .refine((v) => v === "" || z.email().safeParse(v).success, "Enter a valid email address")
    .transform((v) => (v === "" ? null : v)),
  notes: optionalText(5000),
  active: z.boolean(),
});

export type ClientInput = z.infer<typeof clientInputSchema>;
export type ClientField = keyof ClientInput;

/** Initials for an avatar fallback: "Industrial Door Systems" -> "IDS". */
export function clientInitials(name: string): string {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  return letters.slice(0, 3) || "?";
}
