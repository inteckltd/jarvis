import { prisma } from "@jarvis/db";
import { formatLondonDateTime } from "@jarvis/shared";
import { Pencil, Radar, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type * as React from "react";
import { CredentialBadge } from "@/components/accounts/credential-badge";
import { TestConnectionButton } from "@/components/accounts/test-connection-button";
import { Breadcrumbs } from "@/components/hud/breadcrumbs";
import { HudPanel } from "@/components/hud/hud-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ACCOUNT_PUBLIC_SELECT, loadCredentialStatuses } from "@/lib/accounts";
import { ENVIRONMENT_LABEL, PROVIDER_LABEL, RESOURCE_TYPE_LABEL } from "@/lib/labels";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const account = await prisma.providerAccount.findUnique({
    where: { id },
    select: { label: true },
  });
  return { title: account?.label ?? "Account not found" };
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 py-2.5 sm:flex-row sm:items-center sm:justify-between">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

export default async function AccountDetailPage({ params }: Params) {
  const { id } = await params;
  const [account, statuses] = await Promise.all([
    prisma.providerAccount.findUnique({
      where: { id },
      select: {
        ...ACCOUNT_PUBLIC_SELECT,
        resources: {
          orderBy: [{ client: { name: "asc" } }, { name: "asc" }],
          select: {
            id: true,
            name: true,
            type: true,
            environment: true,
            active: true,
            client: { select: { name: true, slug: true } },
          },
        },
      },
    }),
    loadCredentialStatuses(),
  ]);
  if (!account) notFound();

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs
        items={[
          { label: "Settings", href: "/settings" },
          { label: "Provider accounts", href: "/settings/accounts" },
          { label: account.label },
        ]}
      />

      <HudPanel
        label={PROVIDER_LABEL[account.provider]}
        title={account.label}
        actions={
          <>
            <TestConnectionButton accountId={account.id} />
            <Button asChild variant="outline" size="sm">
              <Link href={`/settings/accounts/${account.id}/edit`}>
                <Pencil />
                Edit
              </Link>
            </Button>
          </>
        }
      >
        {account.lastError && (
          <p className="mb-3 flex items-start gap-2 rounded-md border border-status-warning/40 bg-status-warning/10 px-3 py-2 text-sm text-status-warning">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            {account.lastError}
          </p>
        )}
        <dl className="divide-y divide-border/70">
          <Row label="Owner">{account.client ? account.client.name : "Inteck"}</Row>
          <Row label="Token">
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-muted-foreground">
                {account.authType === "ENV_TOKEN" ? account.envVarName : "Encrypted in database"}
              </span>
              <CredentialBadge status={statuses === null ? null : statuses.get(account.id)} />
            </span>
          </Row>
          <Row label="Last verified">
            <span className="font-mono">
              {account.lastVerifiedAt ? formatLondonDateTime(account.lastVerifiedAt) : "Never"}
            </span>
          </Row>
        </dl>
      </HudPanel>

      <HudPanel
        label="Inventory"
        title={`Resources (${account.resources.length})`}
        corners={false}
        actions={
          account.client ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`/clients/${account.client.slug}/resources/import?account=${account.id}`}>
                <Radar />
                Add resources
              </Link>
            </Button>
          ) : undefined
        }
      >
        <p className="mb-3 text-xs text-muted-foreground">
          {account.client
            ? `Resources are imported from ${account.client.name}'s page.`
            : "Resources are imported from each client's page (Clients → client → Add resources)."}
        </p>
        {account.resources.length === 0 ? (
          <p className="text-sm text-muted-foreground">No resources use this account yet.</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {account.resources.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/clients/${r.client.slug}/resources/${r.id}`}
                  className="-mx-2 flex flex-wrap items-center justify-between gap-2 rounded-md px-2 py-2.5 hover:bg-primary/5"
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{r.name}</span>
                    <Badge variant="outline">{RESOURCE_TYPE_LABEL[r.type]}</Badge>
                    {r.environment !== "NONE" && (
                      <Badge variant={r.environment === "PRODUCTION" ? "default" : "secondary"}>
                        {ENVIRONMENT_LABEL[r.environment]}
                      </Badge>
                    )}
                    {!r.active && <Badge variant="nodata">Inactive</Badge>}
                  </span>
                  <span className="text-xs text-muted-foreground">{r.client.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </HudPanel>
    </div>
  );
}
