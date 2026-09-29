import "server-only";
import { prisma } from "@jarvis/db";
import { type EnvironmentName, londonDayKey } from "@jarvis/shared";

export async function loadMobile(resourceIds: string[]) {
  const [versions, builds] = await Promise.all([
    prisma.storeVersion.findMany({
      where: { resourceId: { in: resourceIds } },
      orderBy: [{ releasedAt: { sort: "desc", nulls: "last" } }, { checkedAt: "desc" }],
    }),
    prisma.mobileBuild.findMany({
      where: { resourceId: { in: resourceIds } },
      orderBy: { createdAt: "desc" },
      take: 40 * resourceIds.length,
    }),
  ]);
  const out = new Map<string, { versions: typeof versions; builds: typeof builds }>();
  for (const id of resourceIds) {
    out.set(id, {
      versions: versions.filter((v) => v.resourceId === id),
      builds: builds.filter((b) => b.resourceId === id),
    });
  }
  return out;
}

export type ActivityEvent =
  | {
      kind: "deploy";
      id: string;
      at: Date;
      resourceName: string;
      environment: EnvironmentName;
      status: "BUILDING" | "SUCCESS" | "FAILED" | "CANCELED";
      commitMessage: string | null;
      commitSha: string | null;
      branch: string | null;
      url: string | null;
    }
  | {
      kind: "build";
      id: string;
      at: Date;
      resourceName: string;
      platform: "IOS" | "ANDROID";
      profile: string;
      status: "QUEUED" | "IN_PROGRESS" | "FINISHED" | "ERRORED" | "CANCELED";
      version: string;
      submittedToStore: boolean;
    }
  | { kind: "task"; id: string; at: Date; title: string };

export async function loadActivity(clientId: string, from: Date) {
  const [deploys, builds, tasks] = await Promise.all([
    prisma.deployment.findMany({
      where: { resource: { clientId }, startedAt: { gte: from } },
      orderBy: { startedAt: "desc" },
      include: { resource: { select: { name: true, environment: true } } },
    }),
    prisma.mobileBuild.findMany({
      where: { resource: { clientId }, createdAt: { gte: from } },
      orderBy: { createdAt: "desc" },
      include: { resource: { select: { name: true } } },
    }),
    prisma.task.findMany({
      where: { clientId, completed: true, completedAt: { gte: from } },
      orderBy: { completedAt: "desc" },
      select: { id: true, title: true, completedAt: true },
    }),
  ]);

  const events: ActivityEvent[] = [
    ...deploys.map((d) => ({
      kind: "deploy" as const,
      id: d.id,
      at: d.startedAt,
      resourceName: d.resource.name,
      environment: d.resource.environment,
      status: d.status,
      commitMessage: d.commitMessage ?? d.cause,
      commitSha: d.commitSha,
      branch: d.branch,
      url: d.url,
    })),
    ...builds.map((b) => ({
      kind: "build" as const,
      id: b.id,
      at: b.createdAt,
      resourceName: b.resource.name,
      platform: b.platform,
      profile: b.profile,
      status: b.status,
      version: `${b.appVersion} (${b.buildNumber})`,
      submittedToStore: b.submittedToStore,
    })),
    ...tasks.flatMap((t) =>
      t.completedAt ? [{ kind: "task" as const, id: t.id, at: t.completedAt, title: t.title }] : [],
    ),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());

  const days: { key: string; events: ActivityEvent[] }[] = [];
  for (const e of events) {
    const key = londonDayKey(e.at);
    const last = days[days.length - 1];
    if (last?.key === key) last.events.push(e);
    else days.push({ key, events: [e] });
  }
  return days;
}
