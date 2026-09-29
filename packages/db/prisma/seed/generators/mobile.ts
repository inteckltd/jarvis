import { type MobileBuildStatus, type MobilePlatform, type Prisma } from "@prisma/client";
import { DAY_MS, HOUR_MS, MINUTE_MS } from "@jarvis/shared";
import { ago, type SeedContext } from "../context";
import { createRng, seedFrom } from "../random";

type BuildSpec = {
  daysAgo: number;
  platform: MobilePlatform;
  profile: "production" | "preview";
  status: MobileBuildStatus;
  appVersion: string;
  buildNumber: number;
  submitted: boolean;
};

const BUILDS: readonly BuildSpec[] = [
  {
    daysAgo: 26,
    platform: "IOS",
    profile: "production",
    status: "FINISHED",
    appVersion: "2.3.1",
    buildNumber: 41,
    submitted: true,
  },
  {
    daysAgo: 26,
    platform: "ANDROID",
    profile: "production",
    status: "FINISHED",
    appVersion: "2.3.1",
    buildNumber: 41,
    submitted: true,
  },
  {
    daysAgo: 15,
    platform: "IOS",
    profile: "preview",
    status: "FINISHED",
    appVersion: "2.4.0",
    buildNumber: 42,
    submitted: false,
  },
  {
    daysAgo: 15,
    platform: "ANDROID",
    profile: "preview",
    status: "FINISHED",
    appVersion: "2.4.0",
    buildNumber: 42,
    submitted: false,
  },
  {
    daysAgo: 8,
    platform: "IOS",
    profile: "preview",
    status: "ERRORED",
    appVersion: "2.4.0",
    buildNumber: 43,
    submitted: false,
  },
  {
    daysAgo: 7,
    platform: "IOS",
    profile: "preview",
    status: "FINISHED",
    appVersion: "2.4.0",
    buildNumber: 44,
    submitted: false,
  },
  {
    daysAgo: 2,
    platform: "IOS",
    profile: "production",
    status: "FINISHED",
    appVersion: "2.4.0",
    buildNumber: 45,
    submitted: true,
  },
  {
    daysAgo: 2,
    platform: "ANDROID",
    profile: "production",
    status: "FINISHED",
    appVersion: "2.4.0",
    buildNumber: 45,
    submitted: true,
  },
];

export function mobileBuilds(
  ctx: SeedContext,
  resourceId: string,
): Prisma.MobileBuildCreateManyInput[] {
  const rng = createRng(seedFrom("mobile-builds"));
  return BUILDS.map((b) => {
    const createdAt = ago(ctx, b.daysAgo * DAY_MS - rng.int(0, 6) * HOUR_MS);
    const minutes = b.status === "ERRORED" ? rng.int(4, 9) : rng.int(14, 28);
    return {
      resourceId,
      externalId: rng.uuid(),
      platform: b.platform,
      profile: b.profile,
      status: b.status,
      appVersion: b.appVersion,
      buildNumber: String(b.buildNumber),
      commitSha: rng.hex(40),
      submittedToStore: b.submitted,
      createdAt,
      completedAt: new Date(createdAt.getTime() + minutes * MINUTE_MS),
    };
  });
}

/** iOS App Store versions only; Google Play lookup is phase 2. */
export function storeVersions(
  ctx: SeedContext,
  resourceId: string,
): Prisma.StoreVersionCreateManyInput[] {
  return [
    {
      resourceId,
      platform: "IOS",
      version: "2.3.0",
      releasedAt: ago(ctx, 58 * DAY_MS),
      checkedAt: ago(ctx, 20 * DAY_MS),
    },
    {
      resourceId,
      platform: "IOS",
      version: "2.3.1",
      releasedAt: ago(ctx, 24 * DAY_MS),
      checkedAt: ago(ctx, 1 * HOUR_MS),
    },
  ];
}
