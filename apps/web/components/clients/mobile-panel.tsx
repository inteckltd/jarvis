import type { MobileBuild, StoreVersion } from "@jarvis/db";
import { formatLondonDateTime } from "@jarvis/shared";
import { Pencil, Smartphone } from "lucide-react";
import Link from "next/link";
import { SectionLabel } from "@/components/hud/section-label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BUILD_STATUS } from "@/lib/labels";

const BUILDS_SHOWN = 15;

export function MobilePanel({
  resource,
  versions,
  builds,
  clientSlug,
}: {
  resource: { id: string; name: string; config: Record<string, unknown> };
  versions: StoreVersion[];
  builds: MobileBuild[];
  clientSlug: string;
}) {
  const ios = versions.filter((v) => v.platform === "IOS");
  const latestAndroid = builds.find((b) => b.platform === "ANDROID" && b.submittedToStore);
  const bundleId = typeof resource.config.bundleId === "string" ? resource.config.bundleId : null;

  return (
    <section className="rounded-lg bg-card/70 hud-border">
      <header className="flex items-center justify-between gap-3 border-b border-border/70 px-5 py-3">
        <div>
          <h3 className="flex items-center gap-2 font-semibold">
            <Smartphone className="size-4 text-primary" />
            {resource.name}
          </h3>
          {bundleId && <p className="font-mono text-xs text-muted-foreground">{bundleId}</p>}
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href={`/clients/${clientSlug}/resources/${resource.id}`}>
            <Pencil />
            Settings
          </Link>
        </Button>
      </header>

      <div className="flex flex-col gap-5 px-5 py-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-md border border-border/70 bg-background/40 p-4">
            <SectionLabel>App Store (live)</SectionLabel>
            <p className="mt-1 font-mono text-2xl">{ios[0]?.version ?? "—"}</p>
            <p className="text-xs text-muted-foreground">
              {ios[0]?.releasedAt
                ? `Released ${formatLondonDateTime(ios[0].releasedAt)}`
                : ios[0]
                  ? `Checked ${formatLondonDateTime(ios[0].checkedAt)}`
                  : "Not checked yet"}
            </p>
            {ios.length > 1 && (
              <p className="mt-2 text-xs text-muted-foreground">
                Previous:{" "}
                <span className="font-mono">
                  {ios
                    .slice(1, 4)
                    .map((v) => v.version)
                    .join(", ")}
                </span>
              </p>
            )}
          </div>
          <div className="rounded-md border border-border/70 bg-background/40 p-4">
            <SectionLabel>Google Play</SectionLabel>
            <p className="mt-1 font-mono text-2xl">
              {latestAndroid ? `${latestAndroid.appVersion}` : "—"}
            </p>
            <p className="text-xs text-muted-foreground">
              {latestAndroid
                ? `Latest submitted build (${latestAndroid.buildNumber}) · live version check comes in phase 2`
                : "No submitted Android build"}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <SectionLabel>EAS builds</SectionLabel>
          {builds.length === 0 ? (
            <p className="text-xs text-muted-foreground">No builds recorded.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-[10px] tracking-wider text-muted-foreground uppercase">
                  <tr className="border-b border-border/60">
                    <th className="py-2 pr-4 font-normal">Created</th>
                    <th className="py-2 pr-4 font-normal">Platform</th>
                    <th className="py-2 pr-4 font-normal">Version</th>
                    <th className="py-2 pr-4 font-normal">Profile</th>
                    <th className="py-2 pr-4 font-normal">Status</th>
                    <th className="py-2 font-normal">Commit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {builds.slice(0, BUILDS_SHOWN).map((b) => (
                    <tr key={b.id}>
                      <td className="py-2 pr-4 font-mono text-xs whitespace-nowrap text-muted-foreground">
                        {formatLondonDateTime(b.createdAt)}
                      </td>
                      <td className="py-2 pr-4">{b.platform === "IOS" ? "iOS" : "Android"}</td>
                      <td className="py-2 pr-4 font-mono whitespace-nowrap">
                        {b.appVersion}{" "}
                        <span className="text-muted-foreground">({b.buildNumber})</span>
                      </td>
                      <td className="py-2 pr-4">
                        <Badge variant="outline">{b.profile}</Badge>
                      </td>
                      <td className="py-2 pr-4 whitespace-nowrap">
                        <Badge variant={BUILD_STATUS[b.status].variant}>
                          {BUILD_STATUS[b.status].label}
                        </Badge>
                        {b.submittedToStore && (
                          <Badge variant="outline" className="ml-1">
                            Submitted
                          </Badge>
                        )}
                      </td>
                      <td className="py-2 font-mono text-xs text-muted-foreground">
                        {b.commitSha?.slice(0, 7) ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
