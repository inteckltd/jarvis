import { type DeploymentStatus, type Prisma } from "@prisma/client";
import { DAY_MS, isLondonWeekend, MINUTE_MS } from "@jarvis/shared";
import { ago, type SeedContext } from "../context";
import { COMMIT_MESSAGES, EDGE_FUNCTIONS, type RepoKey } from "../ids";
import { createRng, type Rng, seedFrom } from "../random";

type DeploymentRow = Prisma.DeploymentCreateManyInput;

type Plan = {
  resourceId: string;
  repo: RepoKey;
  branch: string;
  /** Average deployments per weekday. */
  perWeekday: number;
  cause: (rng: Rng, sha: string) => string;
  url?: (rng: Rng) => string;
  durationMin: [number, number];
  failRate: number;
  cancelRate: number;
  externalId: (rng: Rng, index: number) => string;
};

function build(ctx: SeedContext, plan: Plan, seedLabel: string): DeploymentRow[] {
  const rng = createRng(seedFrom(seedLabel));
  const rows: DeploymentRow[] = [];
  const days = Math.round((ctx.now.getTime() - ctx.start.getTime()) / DAY_MS);

  for (let d = days; d >= 0; d--) {
    const day = new Date(ctx.now.getTime() - d * DAY_MS);
    if (isLondonWeekend(day)) continue;
    let count = 0;
    let p = plan.perWeekday;
    while (p > 0) {
      if (rng.chance(Math.min(1, p))) count++;
      p -= 1;
    }
    for (let i = 0; i < count; i++) {
      const startedAt = new Date(day);
      startedAt.setUTCHours(rng.int(8, 16), rng.int(0, 59), rng.int(0, 59), 0);
      if (startedAt >= ctx.now) continue;
      const roll = rng.next();
      const status: DeploymentStatus =
        roll < plan.failRate
          ? "FAILED"
          : roll < plan.failRate + plan.cancelRate
            ? "CANCELED"
            : "SUCCESS";
      const durationMs = rng.int(plan.durationMin[0] * 60, plan.durationMin[1] * 60) * 1000;
      const sha = rng.hex(40);
      rows.push({
        resourceId: plan.resourceId,
        externalId: plan.externalId(rng, rows.length),
        status,
        cause: plan.cause(rng, sha),
        commitSha: sha,
        commitMessage: rng.pick(COMMIT_MESSAGES[plan.repo]),
        branch: plan.branch,
        url: plan.url?.(rng) ?? null,
        startedAt,
        finishedAt: new Date(startedAt.getTime() + durationMs),
      });
    }
  }
  return rows.sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime());
}

/** Force the most recent row to a status (used to set up RAG scenarios). */
function forceLatest(rows: DeploymentRow[], status: DeploymentStatus): void {
  const last = rows.at(-1);
  if (last) last.status = status;
}

function extraDeploy(
  ctx: SeedContext,
  rng: Rng,
  base: Omit<
    DeploymentRow,
    "externalId" | "startedAt" | "finishedAt" | "commitSha" | "commitMessage"
  > & {
    repo: RepoKey;
  },
  minutesAgo: number,
  durationMinutes: number | null,
): DeploymentRow {
  const { repo, ...rest } = base;
  const startedAt = ago(ctx, minutesAgo * MINUTE_MS);
  return {
    ...rest,
    externalId: rng.uuid(),
    commitSha: rng.hex(40),
    commitMessage: rng.pick(COMMIT_MESSAGES[repo]),
    startedAt,
    finishedAt:
      durationMinutes === null ? null : new Date(startedAt.getTime() + durationMinutes * MINUTE_MS),
  };
}

const doCause = (branch: string) => (_rng: Rng, sha: string) =>
  `commit ${sha.slice(0, 7)} pushed to github.com/industrial-door-systems (${branch})`;

export function doAppDeployments(
  ctx: SeedContext,
  ids: { prod: string; dev: string },
  repo: RepoKey,
  key: string,
): { prod: DeploymentRow[]; dev: DeploymentRow[] } {
  const prod = build(
    ctx,
    {
      resourceId: ids.prod,
      repo,
      branch: "main",
      perWeekday: 0.45,
      cause: doCause("main"),
      durationMin: [3, 7],
      failRate: 0,
      cancelRate: 0,
      externalId: (rng) => rng.uuid(),
    },
    `${key}-prod-deploys`,
  );
  const dev = build(
    ctx,
    {
      resourceId: ids.dev,
      repo,
      branch: "pre-production",
      perWeekday: 1.4,
      cause: doCause("pre-production"),
      durationMin: [3, 8],
      failRate: 0.06,
      cancelRate: 0.04,
      externalId: (rng) => rng.uuid(),
    },
    `${key}-dev-deploys`,
  );
  return { prod, dev };
}

export function allDeployments(
  ctx: SeedContext,
  r: {
    workforceProd: string;
    workforceDev: string;
    htmlPdfProd: string;
    htmlPdfDev: string;
    functionsProd: string;
    functionsDev: string;
    uiProd: string;
    uiDev: string;
  },
): { rows: DeploymentRow[]; byResource: Map<string, Date[]> } {
  const rng = createRng(seedFrom("deploy-extras"));

  const workforce = doAppDeployments(
    ctx,
    { prod: r.workforceProd, dev: r.workforceDev },
    "workforceApi",
    "workforce",
  );
  const htmlPdf = doAppDeployments(
    ctx,
    { prod: r.htmlPdfProd, dev: r.htmlPdfDev },
    "htmlPdf",
    "htmlpdf",
  );

  // Development noise that must never turn the client red on its own.
  forceLatest(htmlPdf.dev, "FAILED");
  workforce.dev.push(
    extraDeploy(
      ctx,
      rng,
      {
        resourceId: r.workforceDev,
        repo: "workforceApi",
        status: "BUILDING",
        cause: "commit pushed to github.com/industrial-door-systems (pre-production)",
        branch: "pre-production",
        url: null,
      },
      3,
      null,
    ),
  );

  // Every production deploy succeeds except in the red scenario.
  forceLatest(workforce.prod, "SUCCESS");
  forceLatest(htmlPdf.prod, "SUCCESS");
  if (ctx.scenario === "red") {
    workforce.prod.push(
      extraDeploy(
        ctx,
        rng,
        {
          resourceId: r.workforceProd,
          repo: "workforceApi",
          status: "FAILED",
          cause: "commit pushed to github.com/industrial-door-systems (main)",
          branch: "main",
          url: null,
        },
        45,
        6,
      ),
    );
  }

  const vercelUrl = (branch: string) => (rng: Rng) =>
    branch === "main"
      ? `https://ids-simplx-ui-${rng.hex(9)}-inteck-mock.vercel.app`
      : `https://ids-simplx-ui-git-pre-production-${rng.hex(6)}-inteck-mock.vercel.app`;

  const uiProd = build(
    ctx,
    {
      resourceId: r.uiProd,
      repo: "ui",
      branch: "main",
      perWeekday: 0.4,
      cause: () => "git push (production)",
      url: vercelUrl("main"),
      durationMin: [1, 3],
      failRate: 0,
      cancelRate: 0,
      externalId: (rg) => `dpl_mock_${rg.hex(24)}`,
    },
    "ui-prod-deploys",
  );
  const uiDev = build(
    ctx,
    {
      resourceId: r.uiDev,
      repo: "ui",
      branch: "pre-production",
      perWeekday: 1,
      cause: () => "git push (preview)",
      url: vercelUrl("pre-production"),
      durationMin: [1, 3],
      failRate: 0.05,
      cancelRate: 0.05,
      externalId: (rg) => `dpl_mock_${rg.hex(24)}`,
    },
    "ui-dev-deploys",
  );
  forceLatest(uiProd, "SUCCESS");

  const fnCause = (rg: Rng) => `supabase functions deploy ${rg.pick(EDGE_FUNCTIONS)}`;
  const functionsProd = build(
    ctx,
    {
      resourceId: r.functionsProd,
      repo: "serverless",
      branch: "main",
      perWeekday: 0.2,
      cause: (rg) => fnCause(rg),
      durationMin: [1, 2],
      failRate: 0,
      cancelRate: 0,
      externalId: (rg, i) => `mock-fn-prod-${i}-${rg.hex(6)}`,
    },
    "fn-prod-deploys",
  );
  const functionsDev = build(
    ctx,
    {
      resourceId: r.functionsDev,
      repo: "serverless",
      branch: "pre-production",
      perWeekday: 0.45,
      cause: (rg) => fnCause(rg),
      durationMin: [1, 2],
      failRate: 0.05,
      cancelRate: 0,
      externalId: (rg, i) => `mock-fn-dev-${i}-${rg.hex(6)}`,
    },
    "fn-dev-deploys",
  );
  forceLatest(functionsProd, "SUCCESS");

  const rows = [
    ...workforce.prod,
    ...workforce.dev,
    ...htmlPdf.prod,
    ...htmlPdf.dev,
    ...uiProd,
    ...uiDev,
    ...functionsProd,
    ...functionsDev,
  ];

  // Successful deploy completion times per resource (memory resets after a deploy).
  const byResource = new Map<string, Date[]>();
  for (const row of rows) {
    if (row.status !== "SUCCESS" || !row.finishedAt) continue;
    const list = byResource.get(row.resourceId) ?? [];
    list.push(new Date(row.finishedAt));
    byResource.set(row.resourceId, list);
  }
  return { rows, byResource };
}
