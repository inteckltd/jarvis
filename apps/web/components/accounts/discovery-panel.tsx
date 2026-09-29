"use client";

import { type DiscoveredResource, type EnvironmentName } from "@jarvis/shared";
import { GitBranch, Loader2, Radar, Search, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { discoverAction, type DiscoveryResponse } from "@/app/(app)/settings/accounts/actions";
import { EmptyState } from "@/components/hud/empty-state";
import {
  ResourceForm,
  type ResourceFormAccount,
  type ResourceFormClient,
  type ResourceFormValues,
  vercelBranchFor,
} from "@/components/resources/resource-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { importResourceAction } from "@/lib/actions/resources";
import { ENVIRONMENT_LABEL, RESOURCE_TYPE_LABEL } from "@/lib/labels";

type Props = {
  account: ResourceFormAccount;
  /** Clients resources can be imported into; pass one to import straight into that client. */
  clients: readonly ResourceFormClient[];
  /** Scan as soon as the panel mounts. */
  autoRun?: boolean;
};

const itemKey = (item: DiscoveredResource) => `${item.type}:${item.externalId}`;

function sameRepo(a: { owner: string; name: string }, b: { owner: string; name: string }) {
  return (
    a.owner.toLowerCase() === b.owner.toLowerCase() && a.name.toLowerCase() === b.name.toLowerCase()
  );
}

/** Pre-fill the import form from what the provider told us. */
function initialValues(
  item: DiscoveredResource,
  account: ResourceFormAccount,
  clients: readonly ResourceFormClient[],
): ResourceFormValues {
  const repoRef = item.repository;
  const byRepo = repoRef
    ? clients.find((c) => c.repositories.some((r) => sameRepo(r, repoRef)))
    : undefined;
  const client =
    clients.find((c) => c.id === account.clientId) ??
    byRepo ??
    (clients.length === 1 ? clients[0] : undefined);
  const repo = repoRef ? client?.repositories.find((r) => sameRepo(r, repoRef)) : undefined;

  // If the suggested environment is already imported, offer the other one (e.g. a Vercel project's preview).
  const taken = new Set(item.imported.map((i) => i.environment));
  const alternatives: EnvironmentName[] =
    item.suggestedEnvironment === "NONE"
      ? ["NONE"]
      : [
          item.suggestedEnvironment,
          item.suggestedEnvironment === "PRODUCTION" ? "DEVELOPMENT" : "PRODUCTION",
        ];
  const environment = alternatives.find((e) => !taken.has(e)) ?? item.suggestedEnvironment;

  const config =
    item.type === "VERCEL_PROJECT"
      ? { ...item.config, ...vercelBranchFor(environment, repo, item.branch) }
      : item.config;

  return {
    clientId: client?.id ?? "",
    providerAccountId: account.id,
    type: item.type,
    externalId: item.externalId,
    name: item.name,
    environment,
    region: item.region ?? "",
    liveUrl: environment === item.suggestedEnvironment ? (item.liveUrl ?? "") : "",
    healthCheckUrl:
      environment === item.suggestedEnvironment ? (item.suggestedHealthCheckUrl ?? "") : "",
    repositoryId: repo?.id ?? "",
    active: true,
    config,
  };
}

export function DiscoveryPanel({ account, clients, autoRun = false }: Props) {
  const router = useRouter();
  const [result, setResult] = useState<DiscoveryResponse | null>(null);
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [hideImported, setHideImported] = useState(false);
  const [importing, setImporting] = useState<DiscoveredResource | null>(null);

  const run = useCallback(
    () =>
      startTransition(async () => {
        setResult(await discoverAction(account.id));
      }),
    [account.id],
  );

  const started = useRef(false);
  useEffect(() => {
    if (autoRun && !started.current) {
      started.current = true;
      run();
    }
  }, [autoRun, run]);

  const items = useMemo(() => {
    if (!result?.ok) return [];
    const q = query.trim().toLowerCase();
    return result.items.filter(
      (i) =>
        (!hideImported || i.imported.length === 0) &&
        (!q ||
          i.name.toLowerCase().includes(q) ||
          i.externalId.toLowerCase().includes(q) ||
          (i.repository && `${i.repository.owner}/${i.repository.name}`.toLowerCase().includes(q))),
    );
  }, [result, query, hideImported]);

  const onSaved = useCallback(
    (saved: { name: string; clientName: string; clientSlug: string }) => {
      setImporting(null);
      toast.success(`Imported ${saved.name} for ${saved.clientName}`, {
        action: {
          label: "View client",
          onClick: () => router.push(`/clients/${saved.clientSlug}`),
        },
      });
      run();
      router.refresh();
    },
    [router, run],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={run} disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <Radar />}
          {result ? "Scan again" : "Discover resources"}
        </Button>
        {result?.ok && result.items.length > 0 && (
          <div className="relative min-w-48 flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter by name, ID or repo"
              className="pl-9"
              aria-label="Filter discovered resources"
            />
          </div>
        )}
        {result?.ok && result.items.some((i) => i.imported.length > 0) && (
          <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={hideImported}
              onChange={(e) => setHideImported(e.target.checked)}
              className="size-3.5 accent-primary"
            />
            Hide already imported
          </label>
        )}
        {result?.ok && (
          <span className="font-mono text-xs text-muted-foreground">
            {items.length === result.items.length
              ? `${result.items.length} found`
              : `${items.length} of ${result.items.length}`}
          </span>
        )}
      </div>

      {result && !result.ok && (
        <p className="flex items-start gap-2 rounded-md border border-status-warning/40 bg-status-warning/10 px-3 py-2 text-sm text-status-warning">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          {result.message}
        </p>
      )}

      {result?.ok && result.items.length === 0 && (
        <EmptyState
          icon={<Radar />}
          title="Nothing found"
          description="The token works, but it can't see any resources. Check the token's scopes or team."
          className="py-8"
        />
      )}

      {result?.ok && result.items.length > 0 && items.length === 0 && (
        <p className="py-4 text-center text-sm text-muted-foreground">
          {hideImported && !query
            ? "Everything here is already imported."
            : "Nothing matches the filter."}
        </p>
      )}

      {items.length > 0 && (
        <ul className="divide-y divide-border/60 rounded-md border border-border/60">
          {items.map((item) => (
            <li
              key={itemKey(item)}
              className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{item.name}</span>
                  <Badge variant="outline">{RESOURCE_TYPE_LABEL[item.type]}</Badge>
                  {item.imported.length === 0 && item.suggestedEnvironment !== "NONE" && (
                    <Badge
                      variant={item.suggestedEnvironment === "PRODUCTION" ? "default" : "secondary"}
                    >
                      Looks like {ENVIRONMENT_LABEL[item.suggestedEnvironment].toLowerCase()}
                    </Badge>
                  )}
                </div>
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="max-w-64 truncate font-mono" title={item.externalId}>
                    {item.externalId}
                  </span>
                  {item.region && <span className="font-mono">{item.region}</span>}
                  {item.repository && (
                    <span className="flex items-center gap-1 font-mono">
                      <GitBranch className="size-3" />
                      {item.repository.owner}/{item.repository.name}
                      {item.branch && (
                        <span className="text-muted-foreground/70">@{item.branch}</span>
                      )}
                    </span>
                  )}
                  {item.status && <span className="font-mono">{item.status}</span>}
                </p>
                {item.imported.length > 0 && (
                  <p className="flex flex-wrap items-center gap-2 pt-0.5 text-xs">
                    {item.imported.map((i) => (
                      <Link
                        key={i.resourceId}
                        href={`/clients/${i.clientSlug}/resources/${i.resourceId}`}
                        className="inline-flex"
                      >
                        <Badge variant="healthy">
                          {i.environment === "NONE" ? "Imported" : ENVIRONMENT_LABEL[i.environment]}{" "}
                          · {i.clientName}
                        </Badge>
                      </Link>
                    ))}
                  </p>
                )}
              </div>
              <Button
                variant={item.imported.length ? "outline" : "default"}
                size="sm"
                className="shrink-0"
                onClick={() => setImporting(item)}
              >
                {item.imported.length ? "Import again" : "Import"}
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Sheet open={importing !== null} onOpenChange={(open) => !open && setImporting(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
          {importing && (
            <>
              <SheetHeader className="px-6 pt-6">
                <SheetTitle>Import {importing.name}</SheetTitle>
                <SheetDescription>
                  Confirm the environment and link a repository. You can change these later.
                </SheetDescription>
              </SheetHeader>
              <div className="px-6 pb-6">
                <ResourceForm
                  key={itemKey(importing)}
                  mode="import"
                  initial={initialValues(importing, account, clients)}
                  clients={clients}
                  accounts={[account]}
                  components={importing.components}
                  providerBranch={importing.branch}
                  action={importResourceAction}
                  onSaved={onSaved}
                  cancel={{ onClick: () => setImporting(null) }}
                />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
