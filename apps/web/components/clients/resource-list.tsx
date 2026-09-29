import type { Provider, ResourceType } from "@jarvis/db";
import { ExternalLink, GitBranch, Pencil, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PROVIDER_LABEL, RESOURCE_TYPE_LABEL } from "@/lib/labels";
import { cn } from "@/lib/utils";

export type ResourceListItem = {
  id: string;
  name: string;
  type: ResourceType;
  region: string | null;
  liveUrl: string | null;
  healthCheckUrl: string | null;
  lastError: string | null;
  active: boolean;
  providerAccount: { label: string; provider: Provider };
  repository: { owner: string; name: string } | null;
};

function urlPart(url: string, part: "host" | "pathname"): string {
  try {
    return new URL(url)[part];
  } catch {
    return url;
  }
}

export function ResourceList({
  resources,
  clientSlug,
  muted = false,
}: {
  resources: readonly ResourceListItem[];
  clientSlug: string;
  muted?: boolean;
}) {
  return (
    <ul className="divide-y divide-border/60">
      {resources.map((r) => (
        <li
          key={r.id}
          className={cn(
            "flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between",
            {
              "opacity-50": !r.active,
            },
          )}
        >
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/clients/${clientSlug}/resources/${r.id}`}
                className={cn(
                  "group/name inline-flex items-center gap-1.5 font-medium hover:text-primary",
                  muted && "text-muted-foreground",
                )}
              >
                {r.name}
                <Pencil className="size-3 opacity-0 transition-opacity group-hover/name:opacity-100" />
              </Link>
              <Badge variant="outline">{RESOURCE_TYPE_LABEL[r.type]}</Badge>
              {!r.active && <Badge variant="nodata">Inactive</Badge>}
              {r.lastError && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="warning" tabIndex={0}>
                      <TriangleAlert />
                      Error
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-sm">{r.lastError}</TooltipContent>
                </Tooltip>
              )}
            </div>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span>
                {PROVIDER_LABEL[r.providerAccount.provider]} · {r.providerAccount.label}
              </span>
              {r.region && <span className="font-mono">{r.region}</span>}
              {r.repository && (
                <span className="flex items-center gap-1 font-mono">
                  <GitBranch className="size-3" />
                  {r.repository.name}
                </span>
              )}
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-0.5 text-xs sm:items-end">
            {r.liveUrl && (
              <a
                href={r.liveUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 font-mono text-primary/90 hover:text-primary"
              >
                {urlPart(r.liveUrl, "host")}
                <ExternalLink className="size-3" />
              </a>
            )}
            <span className="font-mono text-muted-foreground">
              {r.healthCheckUrl
                ? `health: ${urlPart(r.healthCheckUrl, "pathname")}`
                : "no health check"}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
