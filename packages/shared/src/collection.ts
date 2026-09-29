import { z } from "zod";

/** Resource types with a live collector in apps/api. Grows as integrations land. */
export const COLLECTABLE_TYPES = ["DO_APP"] as const;

export function isCollectableType(type: string): boolean {
  return (COLLECTABLE_TYPES as readonly string[]).includes(type);
}

export const COLLECTION_SCHEDULE = {
  /** Metrics + deployments. */
  collectCron: "*/5 * * * *",
  rollupCron: "5 * * * *",
  retentionCron: "30 3 * * *",
} as const;

export const resourceSyncResultSchema = z.object({
  resourceId: z.string(),
  ok: z.boolean(),
  samples: z.number().int(),
  deployments: z.number().int(),
  error: z.string().nullable(),
  syncedAt: z.string(),
});

export type ResourceSyncResult = z.infer<typeof resourceSyncResultSchema>;
