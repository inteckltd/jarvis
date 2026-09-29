import { formatLondonTime, parseDateOnly } from "@jarvis/shared";
import { CheckCircle2, GitCommitHorizontal, Rocket, Smartphone } from "lucide-react";
import Link from "next/link";
import { DeployBadge } from "@/components/dashboard/deploy-line";
import { SectionLabel } from "@/components/hud/section-label";
import { Badge } from "@/components/ui/badge";
import type { ActivityEvent } from "@/lib/client-activity";
import { BUILD_STATUS } from "@/lib/labels";
import { cn } from "@/lib/utils";

const dayFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  weekday: "long",
  day: "numeric",
  month: "long",
});

function Event({ e }: { e: ActivityEvent }) {
  const muted = e.kind === "deploy" && e.environment !== "PRODUCTION";
  return (
    <li className={cn("flex gap-3 py-2", muted && "opacity-70")}>
      <time className="w-11 shrink-0 pt-0.5 font-mono text-xs text-muted-foreground">
        {formatLondonTime(e.at)}
      </time>
      <span className="pt-0.5 text-primary">
        {e.kind === "deploy" ? (
          <Rocket className="size-3.5" />
        ) : e.kind === "build" ? (
          <Smartphone className="size-3.5" />
        ) : (
          <CheckCircle2 className="size-3.5 text-status-healthy" />
        )}
      </span>
      <div className="min-w-0 flex-1 text-sm">
        {e.kind === "deploy" && (
          <>
            <p className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{e.resourceName}</span>
              <Badge variant={e.environment === "PRODUCTION" ? "default" : "outline"}>
                {e.environment === "PRODUCTION" ? "Prod" : "Dev"}
              </Badge>
              <DeployBadge status={e.status} />
              {e.branch && (
                <span className="font-mono text-xs text-muted-foreground">{e.branch}</span>
              )}
            </p>
            <p className="mt-0.5 flex items-center gap-2 truncate text-xs text-muted-foreground">
              {e.commitSha && (
                <span className="flex shrink-0 items-center gap-1 font-mono">
                  <GitCommitHorizontal className="size-3" />
                  {e.commitSha.slice(0, 7)}
                </span>
              )}
              <span className="truncate">{e.commitMessage ?? "No commit message"}</span>
            </p>
          </>
        )}
        {e.kind === "build" && (
          <p className="flex flex-wrap items-center gap-2">
            <span className="font-medium">
              {e.platform === "IOS" ? "iOS" : "Android"} build {e.version}
            </span>
            <Badge variant="outline">{e.profile}</Badge>
            <Badge variant={BUILD_STATUS[e.status].variant}>{BUILD_STATUS[e.status].label}</Badge>
            {e.submittedToStore && <Badge variant="outline">Submitted to store</Badge>}
          </p>
        )}
        {e.kind === "task" && (
          <p>
            Completed{" "}
            <Link href={`/tasks/${e.id}`} className="font-medium hover:text-primary">
              {e.title}
            </Link>
          </p>
        )}
      </div>
    </li>
  );
}

export function ActivityTimeline({ days }: { days: { key: string; events: ActivityEvent[] }[] }) {
  if (days.length === 0) {
    return <p className="text-sm text-muted-foreground">No activity in this range.</p>;
  }
  return (
    <ol className="flex flex-col gap-5">
      {days.map((day) => {
        const date = parseDateOnly(day.key);
        return (
          <li key={day.key}>
            <SectionLabel className="mb-1">{date ? dayFmt.format(date) : day.key}</SectionLabel>
            <ul className="divide-y divide-border/50 border-l border-primary/20 pl-3">
              {day.events.map((e) => (
                <Event key={`${e.kind}-${e.id}`} e={e} />
              ))}
            </ul>
          </li>
        );
      })}
    </ol>
  );
}
