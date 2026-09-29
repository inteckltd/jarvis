import { prisma } from "@jarvis/db";
import { formatLondonDateTime } from "@jarvis/shared";
import { ChevronRight, KeyRound, Plus, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CredentialBadge } from "@/components/accounts/credential-badge";
import { Breadcrumbs } from "@/components/hud/breadcrumbs";
import { EmptyState } from "@/components/hud/empty-state";
import { HudPanel } from "@/components/hud/hud-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ACCOUNT_PUBLIC_SELECT, loadCredentialStatuses } from "@/lib/accounts";
import { PROVIDER_LABEL } from "@/lib/labels";

export const metadata: Metadata = { title: "Provider accounts" };

export default async function ProviderAccountsPage() {
  const [accounts, statuses] = await Promise.all([
    prisma.providerAccount.findMany({
      orderBy: [{ provider: "asc" }, { label: "asc" }],
      select: ACCOUNT_PUBLIC_SELECT,
    }),
    loadCredentialStatuses(),
  ]);

  const addButton = (
    <Button asChild size="sm">
      <Link href="/settings/accounts/new">
        <Plus />
        Add account
      </Link>
    </Button>
  );

  return (
    <div className="flex flex-col gap-4">
      <Breadcrumbs
        items={[{ label: "Settings", href: "/settings" }, { label: "Provider accounts" }]}
      />
      <HudPanel label="Integrations" title="Provider accounts" actions={addButton}>
        <p className="mb-4 text-sm text-muted-foreground">
          The tokens Jarvis uses to read from each provider. Inteck accounts are shared by all
          clients; resources are imported from each client&apos;s page.
        </p>
        {statuses === null && accounts.length > 0 && (
          <p className="mb-4 flex items-center gap-2 rounded-md border border-status-nodata/40 bg-status-nodata/10 px-3 py-2 text-sm text-muted-foreground">
            <TriangleAlert className="size-4 text-status-warning" />
            The Jarvis API is unreachable, so token status is unknown. Start it with{" "}
            <code className="font-mono">pnpm dev</code>.
          </p>
        )}
        {accounts.length === 0 ? (
          <EmptyState
            icon={<KeyRound />}
            title="No provider accounts yet"
            description="Add Inteck's DigitalOcean, Supabase, Vercel and Expo tokens once; every client's page can then import from them."
            action={addButton}
          />
        ) : (
          <ul className="divide-y divide-border/60">
            {accounts.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/settings/accounts/${a.id}`}
                  className="group -mx-2 flex flex-col gap-2 rounded-md px-2 py-3 transition-colors hover:bg-primary/5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{a.label}</span>
                      <Badge variant="outline">{PROVIDER_LABEL[a.provider]}</Badge>
                      {a.lastError && (
                        <Badge variant="warning">
                          <TriangleAlert />
                          Error
                        </Badge>
                      )}
                    </div>
                    <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span>{a.client ? `Owned by ${a.client.name}` : "Inteck-owned"}</span>
                      <span className="font-mono">
                        {a.authType === "ENV_TOKEN"
                          ? `env ${a.envVarName ?? "?"}`
                          : "encrypted token"}
                      </span>
                      <span>
                        {a._count.resources} resource{a._count.resources === 1 ? "" : "s"}
                      </span>
                      <span>
                        {a.lastVerifiedAt
                          ? `Verified ${formatLondonDateTime(a.lastVerifiedAt)}`
                          : "Never verified"}
                      </span>
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <CredentialBadge status={statuses === null ? null : statuses.get(a.id)} />
                    <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </HudPanel>
    </div>
  );
}
