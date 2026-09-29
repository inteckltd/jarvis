import { DISCOVERABLE_TYPES, isConnectableProvider } from "@jarvis/shared";
import { KeyRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/hud/breadcrumbs";
import { EmptyState } from "@/components/hud/empty-state";
import { HudPanel } from "@/components/hud/hud-panel";
import { ResourceForm } from "@/components/resources/resource-form";
import { Button } from "@/components/ui/button";
import { createResourceAction } from "@/lib/actions/resources";
import { loadFormAccounts, loadFormClient } from "@/lib/resource-form-data";

export const metadata: Metadata = { title: "Add resource" };

type Params = { params: Promise<{ slug: string }> };

export default async function NewResourcePage({ params }: Params) {
  const { slug } = await params;
  const client = await loadFormClient(slug);
  if (!client) notFound();
  const accounts = await loadFormAccounts(client.id);
  const first = accounts[0];

  return (
    <div className="flex flex-col gap-4">
      <Breadcrumbs
        items={[
          { label: "Clients", href: "/clients" },
          { label: client.name, href: `/clients/${slug}` },
          { label: "Add resource" },
        ]}
      />
      <HudPanel label="Inventory" title="Add a resource manually" className="max-w-3xl">
        {first ? (
          <>
            <p className="mb-5 text-sm text-muted-foreground">
              Prefer{" "}
              <Link
                href={`/clients/${slug}/resources/import`}
                className="text-primary hover:underline"
              >
                importing from the provider
              </Link>{" "}
              where the provider token is available; use this form when it isn&apos;t.
            </p>
            <ResourceForm
              mode="create"
              initial={{
                clientId: client.id,
                providerAccountId: first.id,
                type: isConnectableProvider(first.provider)
                  ? (DISCOVERABLE_TYPES[first.provider][0] ?? "DO_APP")
                  : "DO_APP",
                externalId: "",
                name: "",
                environment: "PRODUCTION",
                region: "",
                liveUrl: "",
                healthCheckUrl: "",
                repositoryId: "",
                active: true,
                config: {},
              }}
              clients={[client]}
              accounts={accounts}
              action={createResourceAction}
              cancel={{ href: `/clients/${slug}` }}
            />
          </>
        ) : (
          <EmptyState
            icon={<KeyRound />}
            title="Add a provider account first"
            description="Every resource belongs to a provider account (DigitalOcean, Supabase, Vercel or Expo)."
            action={
              <Button asChild>
                <Link href="/settings/accounts/new">Add account</Link>
              </Button>
            }
          />
        )}
      </HudPanel>
    </div>
  );
}
