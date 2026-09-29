/**
 * Removes the mock data created by the seed, keeping everything that is real config:
 * clients, provider accounts, repositories, and any resources/tasks you created.
 *
 * Deletes:
 *   - seeded resources (matched by exact type + fake externalId), which cascades to their
 *     metrics, rollups, health checks, deployments, builds, store versions, function stats
 *   - seeded tasks (matched by exact title, on the seeded client or internal) and comments
 *
 * Dry run by default. Pass --yes to delete.
 */
import { PrismaClient } from "@prisma/client";
import { SEEDED_TASK_TITLES } from "./seed/generators/tasks";
import { IDS_CLIENT, RESOURCES } from "./seed/ids";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const apply = process.argv.includes("--yes");
  const client = await prisma.client.findUnique({
    where: { slug: IDS_CLIENT.slug },
    select: { id: true, name: true },
  });

  const mockKeys = Object.values(RESOURCES).map((r) => ({
    type: r.type,
    externalId: r.externalId,
  }));
  const resources = await prisma.resource.findMany({
    where: { OR: mockKeys },
    orderBy: [{ name: "asc" }, { environment: "asc" }],
    select: {
      id: true,
      name: true,
      environment: true,
      type: true,
      externalId: true,
      _count: {
        select: {
          metricSnapshots: true,
          metricRollups: true,
          healthChecks: true,
          deployments: true,
          mobileBuilds: true,
          storeVersions: true,
          functionStats: true,
        },
      },
    },
  });

  const tasks = await prisma.task.findMany({
    where: {
      title: { in: [...SEEDED_TASK_TITLES] },
      OR: [{ clientId: null }, ...(client ? [{ clientId: client.id }] : [])],
    },
    select: { id: true, title: true, _count: { select: { comments: true } } },
  });

  console.log(apply ? "Deleting mock data…" : "Dry run — nothing will be deleted.\n");
  console.log(`Mock resources: ${resources.length}`);
  for (const r of resources) {
    const rows = Object.values(r._count).reduce((a, b) => a + b, 0);
    console.log(
      `  ${r.name.padEnd(16)} ${r.environment.padEnd(11)} ${r.type.padEnd(18)} ${r.externalId.padEnd(32)} ${rows.toLocaleString("en-GB")} rows`,
    );
  }
  const comments = tasks.reduce((a, t) => a + t._count.comments, 0);
  console.log(`Seeded tasks: ${tasks.length} (${comments} comments)`);

  const kept = await prisma.resource.count({ where: { NOT: { OR: mockKeys } } });
  console.log(
    `\nKept: clients, provider accounts, repositories, ${kept} real resource${kept === 1 ? "" : "s"} and your own tasks.`,
  );

  if (!apply) {
    console.log("\nRun again with --yes to delete:  pnpm db:clear-mock -- --yes");
    return;
  }

  await prisma.$transaction(
    async (tx) => {
      await tx.task.deleteMany({ where: { id: { in: tasks.map((t) => t.id) } } });
      await tx.resource.deleteMany({ where: { id: { in: resources.map((r) => r.id) } } });
    },
    { timeout: 120_000 },
  );
  console.log("\nDone.");
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
