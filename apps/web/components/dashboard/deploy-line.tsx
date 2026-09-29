import { formatAgo } from "@jarvis/shared";
import { GitCommitHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { DeploymentView } from "@/lib/dashboard";
import { DEPLOYMENT_STATUS } from "@/lib/labels";
import { cn } from "@/lib/utils";

export function DeployBadge({ status }: { status: DeploymentView["status"] }) {
  const s = DEPLOYMENT_STATUS[status];
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

/** One deployment: status, commit message, branch and when. */
export function DeployLine({
  deployment,
  now,
  showResource = false,
  className,
}: {
  deployment: DeploymentView;
  now: Date;
  showResource?: boolean;
  className?: string;
}) {
  const d = deployment;
  return (
    <div className={cn("flex min-w-0 items-center gap-2 text-xs", className)}>
      <DeployBadge status={d.status} />
      {showResource && <span className="shrink-0 font-medium">{d.resourceName}</span>}
      <span className="min-w-0 flex-1 truncate text-muted-foreground" title={d.commitMessage ?? ""}>
        {d.commitMessage ?? "No commit message"}
      </span>
      {d.commitSha && (
        <span className="hidden shrink-0 items-center gap-1 font-mono text-muted-foreground sm:flex">
          <GitCommitHorizontal className="size-3" />
          {d.commitSha.slice(0, 7)}
        </span>
      )}
      <time
        dateTime={d.startedAt.toISOString()}
        className="shrink-0 font-mono text-muted-foreground"
      >
        {formatAgo(d.startedAt, now)}
      </time>
    </div>
  );
}
