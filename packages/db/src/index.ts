import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/**
 * Postgres schema Prisma uses (from `?schema=` in DATABASE_URL, default "public").
 * Raw queries must qualify tables with it: through the Supabase pooler the session
 * search_path is not reliably set.
 */
export const DB_SCHEMA: string = (() => {
  try {
    const url = new URL(process.env.DATABASE_URL ?? "");
    const schema = url.searchParams.get("schema");
    return schema && /^[A-Za-z_][A-Za-z0-9_]*$/.test(schema) ? schema : "public";
  } catch {
    return "public";
  }
})();

/** `"schema"."Table"` for use with Prisma.raw in $queryRaw. */
export function qualifiedTable(table: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(table)) throw new Error(`Invalid table name: ${table}`);
  return `"${DB_SCHEMA}"."${table}"`;
}

export * from "@prisma/client";
