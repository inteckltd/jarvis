import { prisma } from "@jarvis/db";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClientAccountAction } from "@/app/(app)/settings/accounts/actions";
import { AccountForm } from "@/components/accounts/account-form";
import { Breadcrumbs } from "@/components/hud/breadcrumbs";
import { HudPanel } from "@/components/hud/hud-panel";

export const metadata: Metadata = { title: "Connect client account" };

type Params = { params: Promise<{ slug: string }> };

export default async function NewClientAccountPage({ params }: Params) {
  const { slug } = await params;
  const client = await prisma.client.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true },
  });
  if (!client) notFound();

  return (
    <div className="flex flex-col gap-4">
      <Breadcrumbs
        items={[
          { label: "Clients", href: "/clients" },
          { label: client.name, href: `/clients/${client.slug}` },
          { label: "Add resources", href: `/clients/${client.slug}/resources/import` },
          { label: "Connect account" },
        ]}
      />
      <HudPanel
        label="Client-owned"
        title={`Connect ${client.name}'s own account`}
        className="max-w-3xl"
      >
        <p className="mb-5 text-sm text-muted-foreground">
          Only needed when {client.name} gives you access to an account they own. Resources in
          Inteck&apos;s own accounts use the shared tokens under Settings.
        </p>
        <AccountForm
          mode="create"
          initial={{
            provider: "DIGITALOCEAN",
            label: `${client.name} DigitalOcean`,
            clientId: client.id,
            authType: "ENCRYPTED_TOKEN",
            envVarName: "DO_API_TOKEN",
          }}
          clients={[]}
          fixedOwner={{ id: client.id, name: client.name }}
          action={createClientAccountAction.bind(null, client.slug)}
          cancelHref={`/clients/${client.slug}/resources/import`}
        />
      </HudPanel>
    </div>
  );
}
