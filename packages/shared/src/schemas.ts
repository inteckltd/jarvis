import { z } from "zod";

/** Report month, "YYYY-MM". */
export const monthStringSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Expected YYYY-MM");

export const emailSchema = z.email().transform((v) => v.trim().toLowerCase());

export const doAppConfigSchema = z.object({
  componentName: z.string().min(1),
});

export const expoAppConfigSchema = z.object({
  bundleId: z.string().min(1).optional(),
  iosAppId: z.string().min(1).optional(),
  androidPackage: z.string().min(1).optional(),
});

export const supabaseProjectConfigSchema = z.object({
  plan: z.string().optional(),
});

export const vercelProjectConfigSchema = z.object({
  /** Branch whose deployments this resource tracks (e.g. "pre-production" for DEVELOPMENT). */
  branch: z.string().optional(),
  target: z.enum(["production", "preview"]).optional(),
});

export const emptyConfigSchema = z.object({}).loose();
