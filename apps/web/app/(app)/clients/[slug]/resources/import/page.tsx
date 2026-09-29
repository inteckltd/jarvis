import { isConnectableProvider } from "@jarvis/shared";
import { KeyRound, PencilLine, Plus, Settings2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CredentialBadge } from "@/components/accounts/credential-badge";
import { DiscoveryPanel } from "@/components/accounts/discovery-panel";
import { Breadcrumbs } from "@/components/hud/breadcrumbs";
import { EmptyState } from "@/components/hud/empty-state";
import { HudPanel } from "@/components/hud/hud-panel";
import { Button } from "@/components/ui/button";
import { loadCredentialStatuses } from "@/lib/accounts";
import { PROVIDER_LABEL } from "@/lib/labels";
import { loadFormAccounts, loadFormClient } from "@/lib/resource-form-data";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Add resources" };

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ account?: string | string[] }>;
};

export default async function ImportResourcesPage({ params, searchParams }: Props) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const client = await loadFormClient(slug);
  if (!client) notFound();

  const [accounts, statuses] = await Promise.all([
    loadFormAccounts(client.id),
    loadCredentialStatuses(),
  ]);
  const requested = typeof query.account === "string" ? query.account : undefined;
  const selected =
    accounts.find((a) => a.id === requested) ??
    accounts.find((a) => statuses?.get(a.id)?.status === "ok") ??
    accounts[0];
  const selectedStatus = selected && statuses ? statuses.get(selected.id) : undefined;
  const tokenReady = statuses === null || selectedStatus?.status === "ok";

  const base = `/clients/${slug}`;
  const connectOwn = (
    <Button asChild variant="outline" size="sm">
      <Link href={`${base}/accounts/new`}>
        <Plus />
        Connect {client.name}&apos;s own account
      </Link>
    </Button>
  );

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs
        items={[
          { label: "Clients", href: "/clients" },
          { label: client.name, href: base },
          { label: "Add resources" },
        ]}
      />

      <HudPanel
        label="Step 1"
        title="Choose where the resources live"
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link href={`${base}/resources/new`}>
              <PencilLine />
              Add manually
            </Link>
          </Button>
        }
      >
        {accounts.length === 0 ? (
          <EmptyState
            icon={<KeyRound />}
            title="No provider accounts yet"
            description="Add Inteck's DigitalOcean, Supabase, Vercel or Expo token once in Settings, and it can be used for every client."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button asChild size="sm">
                  <Link href="/settings/accounts/new">Add an Inteck account</Link>
                </Button>
                {connectOwn}
              </div>
            }
          />
        ) : (
          <div className="flex flex-col gap-4">
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {accounts.map((a) => {
                const active = a.id === selected?.id;
                return (
                  <Link
                    key={a.id}
                    href={`${base}/resources/import?account=${a.id}`}
                    aria-current={active ? "true" : undefined}
                    className={cn(
                      "flex flex-col gap-2 rounded-md border px-3 py-2.5 transition-colors",
                      active
                        ? "border-primary/60 bg-primary/10 shadow-[0_0_18px_-8px_var(--glow)]"
                        : "border-border/70 hover:border-primary/40",
                    )}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className={cn("font-medium", active && "text-primary")}>
                        {PROVIDER_LABEL[a.provider]}
                      </span>
                      <CredentialBadge status={statuses === null ? null : statuses.get(a.id)} />
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {a.label} · {a.clientId ? "client-owned" : "Inteck"}
                    </span>
                  </Link>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                Inteck accounts are shared by all clients; tokens are managed in{" "}
                <Link href="/settings/accounts" className="text-primary hover:underline">
                  Settings
                </Link>
                .
              </p>
              {connectOwn}
            </div>
          </div>
        )}
      </HudPanel>

      {selected && isConnectableProvider(selected.provider) && (
        <HudPanel
          label="Step 2"
          title={`Import from ${PROVIDER_LABEL[selected.provider]}`}
          corners={false}
          actions={
            <Button asChild variant="ghost" size="sm">
              <Link href={`/settings/accounts/${selected.id}`}>
                <Settings2 />
                Token settings
              </Link>
            </Button>
          }
        >
          {!tokenReady && selectedStatus?.detail && (
            <p className="mb-4 text-sm text-status-warning">
              {selectedStatus.detail}. Add it to the root <code className="font-mono">.env</code>{" "}
              and restart the API, then scan.
            </p>
          )}
          <p className="mb-4 text-sm text-muted-foreground">
            Everything this account can see is listed. Resources already imported for another client
            are marked. Import each environment as its own resource.
          </p>
          <DiscoveryPanel
            key={selected.id}
            account={selected}
            clients={[client]}
            autoRun={tokenReady}
          />
        </HudPanel>
      )}
    </div>
  );
}
