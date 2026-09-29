import { PrismaClient } from "@prisma/client";
import { DAY_MS, HOUR_MS, type MetricSample, rollupHourly } from "@jarvis/shared";
import { ago, createContext, type Scenario, SCENARIOS, type SeedContext } from "./context";
import { allDeployments } from "./generators/deployments";
import { functionStats } from "./generators/functions";
import { healthChecks, type HealthProfile, outage } from "./generators/health";
import {
  type AppProfile,
  doAppSnapshots,
  randomRestarts,
  restartTimes,
  supabaseDbSnapshots,
} from "./generators/metrics";
import { mobileBuilds, storeVersions } from "./generators/mobile";
import { tasks } from "./generators/tasks";
import {
  GITHUB_ORG,
  IDS_CLIENT,
  PROVIDER_ACCOUNTS,
  type RepoKey,
  REPOSITORIES,
  type ResourceKey,
  RESOURCES,
} from "./ids";

const prisma = new PrismaClient();
const CHUNK = 5000;
const GB = 1024 ** 3;
const MB = 1024 ** 2;

function parseArgs(argv: readonly string[]): { scenario: Scenario; force: boolean } {
  let scenario: Scenario = "amber";
  let force = false;
  for (const arg of argv) {
    if (arg === "--force") force = true;
    const match = /^--scenario=(.+)$/.exec(arg);
    if (match) {
      const value = match[1];
      if (!SCENARIOS.includes(value as Scenario)) {
        throw new Error(`Unknown scenario "${value}". Use one of: ${SCENARIOS.join(", ")}`);
      }
      scenario = value as Scenario;
    }
  }
  return { scenario, force };
}

async function insertChunked<T>(
  label: string,
  rows: readonly T[],
  insert: (chunk: T[]) => Promise<unknown>,
) {
  for (let i = 0; i < rows.length; i += CHUNK) {
    await insert(rows.slice(i, i + CHUNK));
  }
  console.log(`  ${label.padEnd(20)} ${rows.length.toLocaleString("en-GB")}`);
}

async function reset(): Promise<void> {
  // Children cascade from Resource; explicit order keeps FK constraints happy.
  await prisma.report.deleteMany();
  await prisma.task.deleteMany();
  await prisma.resource.deleteMany();
  await prisma.repository.deleteMany();
  await prisma.providerAccount.deleteMany();
  await prisma.client.deleteMany();
}

async function seedStructure() {
  const client = await prisma.client.create({ data: IDS_CLIENT });

  const accounts = Object.fromEntries(
    await Promise.all(
      Object.entries(PROVIDER_ACCOUNTS).map(async ([key, a]) => {
        const row = await prisma.providerAccount.create({
          data: {
            clientId: null,
            label: a.label,
            provider: a.provider,
            authType: "ENV_TOKEN",
            envVarName: a.envVarName,
          },
        });
        return [key, row.id] as const;
      }),
    ),
  ) as Record<keyof typeof PROVIDER_ACCOUNTS, string>;

  const repos = Object.fromEntries(
    await Promise.all(
      Object.entries(REPOSITORIES).map(async ([key, r]) => {
        const row = await prisma.repository.create({
          data: {
            clientId: client.id,
            owner: GITHUB_ORG,
            name: r.name,
            productionBranch: r.productionBranch,
            developmentBranch: r.developmentBranch,
          },
        });
        return [key, row.id] as const;
      }),
    ),
  ) as Record<RepoKey, string>;

  const resources = Object.fromEntries(
    await Promise.all(
      Object.entries(RESOURCES).map(async ([key, r]) => {
        const row = await prisma.resource.create({
          data: {
            clientId: client.id,
            providerAccountId: accounts[r.account],
            name: r.name,
            environment: r.environment,
            type: r.type,
            externalId: r.externalId,
            region: r.region,
            liveUrl: r.liveUrl,
            healthCheckUrl: r.healthCheckUrl,
            repositoryId: r.repo ? repos[r.repo] : null,
            config: r.config,
          },
        });
        return [key, row.id] as const;
      }),
    ),
  ) as Record<ResourceKey, string>;

  return { client, resources };
}

function appProfiles(
  ctx: SeedContext,
): Record<"workforceProd" | "workforceDev" | "htmlPdfProd" | "htmlPdfDev", AppProfile> {
  const pressure =
    ctx.scenario === "healthy"
      ? undefined
      : { from: ago(ctx, 30 * HOUR_MS), floor: 68, peak: 78.5 };
  return {
    workforceProd: { cpuBase: 4, cpuPeak: 38, memBase: 42, memGrowthPerDay: 1.6, memMax: 70 },
    workforceDev: { cpuBase: 1.5, cpuPeak: 9, memBase: 35, memGrowthPerDay: 1.2, memMax: 62 },
    htmlPdfProd: {
      cpuBase: 3,
      cpuPeak: 46,
      memBase: 48,
      memGrowthPerDay: 2.1,
      memMax: 72,
      memPressure: pressure,
    },
    htmlPdfDev: { cpuBase: 1, cpuPeak: 12, memBase: 40, memGrowthPerDay: 1.5, memMax: 66 },
  };
}

function restartPlan(ctx: SeedContext) {
  const recentProd = ctx.scenario === "healthy" ? [] : [6];
  return {
    workforceProd: restartTimes(ctx, [9.3, 21.6], recentProd),
    // Restart during the outage 12 days ago.
    htmlPdfProd: restartTimes(ctx, [12 - 10 / (24 * 60)], []),
    workforceDev: randomRestarts(ctx, 5, "workforce-dev-restarts"),
    htmlPdfDev: randomRestarts(ctx, 7, "htmlpdf-dev-restarts"),
  };
}

function healthProfiles(ctx: SeedContext): Partial<Record<ResourceKey, HealthProfile>> {
  const htmlPdfOutages = [outage(ctx, 12 * DAY_MS, 15)];
  if (ctx.scenario === "red") htmlPdfOutages.push(outage(ctx, 8 * 60_000, 60));
  return {
    workforceProd: { baseMs: 140, blipRate: 0.0003, outages: [] },
    workforceDev: { baseMs: 190, blipRate: 0.004, outages: [outage(ctx, 17 * DAY_MS, 40)] },
    htmlPdfProd: { baseMs: 210, blipRate: 0.0003, outages: htmlPdfOutages },
    htmlPdfDev: { baseMs: 260, blipRate: 0.005, outages: [outage(ctx, 5 * DAY_MS, 25)] },
    uiProd: { baseMs: 85, blipRate: 0.0001, outages: [] },
    uiDev: { baseMs: 110, blipRate: 0.001, outages: [] },
  };
}

async function main(): Promise<void> {
  const { scenario, force } = parseArgs(process.argv.slice(2));
  if (process.env.NODE_ENV === "production" && !force) {
    throw new Error(
      "Refusing to seed with NODE_ENV=production (this wipes all Jarvis data). Pass --force to override.",
    );
  }

  const ctx = createContext(scenario);
  console.log(
    `Seeding Jarvis (scenario: ${scenario}, ${ctx.start.toISOString()} → ${ctx.now.toISOString()})`,
  );

  console.log("Resetting database…");
  await reset();

  const { client, resources: r } = await seedStructure();
  console.log(`  client               ${client.name}`);
  console.log(`  resources            ${Object.keys(r).length}`);

  // Deployments first: successful deploys reset memory growth in the metric generators.
  const deployments = allDeployments(ctx, r);
  await insertChunked("deployments", deployments.rows, (data) =>
    prisma.deployment.createMany({ data }),
  );

  const restarts = restartPlan(ctx);
  const profiles = appProfiles(ctx);
  const deploysFor = (id: string) => deployments.byResource.get(id) ?? [];

  const metricSets = [
    {
      id: r.workforceProd,
      ...doAppSnapshots(
        ctx,
        r.workforceProd,
        profiles.workforceProd,
        deploysFor(r.workforceProd),
        restarts.workforceProd,
        "m-wf-prod",
      ),
    },
    {
      id: r.workforceDev,
      ...doAppSnapshots(
        ctx,
        r.workforceDev,
        profiles.workforceDev,
        deploysFor(r.workforceDev),
        restarts.workforceDev,
        "m-wf-dev",
      ),
    },
    {
      id: r.htmlPdfProd,
      ...doAppSnapshots(
        ctx,
        r.htmlPdfProd,
        profiles.htmlPdfProd,
        deploysFor(r.htmlPdfProd),
        restarts.htmlPdfProd,
        "m-pdf-prod",
      ),
    },
    {
      id: r.htmlPdfDev,
      ...doAppSnapshots(
        ctx,
        r.htmlPdfDev,
        profiles.htmlPdfDev,
        deploysFor(r.htmlPdfDev),
        restarts.htmlPdfDev,
        "m-pdf-dev",
      ),
    },
    {
      id: r.dbProd,
      ...supabaseDbSnapshots(
        ctx,
        r.dbProd,
        {
          cpuBase: 6,
          cpuPeak: 28,
          memBase: 58,
          connBase: 12,
          connPeak: 34,
          sizeStartBytes: 1.2 * GB,
          sizeEndBytes: 1.34 * GB,
          diskSizeBytes: 8 * GB,
          overheadBytes: 0.35 * GB,
        },
        "m-db-prod",
      ),
    },
    {
      id: r.dbDev,
      ...supabaseDbSnapshots(
        ctx,
        r.dbDev,
        {
          cpuBase: 2,
          cpuPeak: 7,
          memBase: 40,
          connBase: 4,
          connPeak: 6,
          sizeStartBytes: 148 * MB,
          sizeEndBytes: 156 * MB,
          diskSizeBytes: 8 * GB,
          overheadBytes: 0.3 * GB,
        },
        "m-db-dev",
      ),
    },
  ];

  const snapshotRows = metricSets.flatMap((m) => m.rows);
  await insertChunked("metric snapshots", snapshotRows, (data) =>
    prisma.metricSnapshot.createMany({ data }),
  );

  const rollupRows = metricSets.flatMap((m) =>
    rollupHourly(m.samples satisfies MetricSample[]).map((h) => ({ resourceId: m.id, ...h })),
  );
  await insertChunked("hourly rollups", rollupRows, (data) =>
    prisma.metricRollupHourly.createMany({ data }),
  );

  const health = healthProfiles(ctx);
  const healthRows = Object.entries(health).flatMap(([key, profile]) =>
    profile ? healthChecks(ctx, r[key as ResourceKey], profile, `h-${key}`) : [],
  );
  await insertChunked("health checks", healthRows, (data) =>
    prisma.healthCheck.createMany({ data }),
  );

  const fnRows = [
    ...functionStats(
      ctx,
      r.functionsProd,
      { weekday: [3000, 6000], weekend: [600, 1200], errorRate: [0.002, 0.008] },
      "fn-prod",
    ),
    ...functionStats(
      ctx,
      r.functionsDev,
      { weekday: [50, 300], weekend: [0, 40], errorRate: [0.01, 0.03] },
      "fn-dev",
    ),
  ];
  await insertChunked("function stats", fnRows, (data) =>
    prisma.functionStats.createMany({ data }),
  );

  await insertChunked("mobile builds", mobileBuilds(ctx, r.mobile), (data) =>
    prisma.mobileBuild.createMany({ data }),
  );
  await insertChunked("store versions", storeVersions(ctx, r.mobile), (data) =>
    prisma.storeVersion.createMany({ data }),
  );
  const taskRows = tasks(ctx, client.id);
  for (const data of taskRows) await prisma.task.create({ data });
  console.log(`  ${"tasks".padEnd(20)} ${taskRows.length}`);

  console.log("Done.");
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
