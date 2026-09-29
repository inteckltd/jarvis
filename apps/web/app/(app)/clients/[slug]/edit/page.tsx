import { prisma } from "@jarvis/db";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ClientForm } from "@/components/clients/client-form";
import { Breadcrumbs } from "@/components/hud/breadcrumbs";
import { HudPanel } from "@/components/hud/hud-panel";
import { updateClientAction } from "../../actions";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const client = await prisma.client.findUnique({ where: { slug }, select: { name: true } });
  return { title: client ? `Edit ${client.name}` : "Client not found" };
}

export default async function EditClientPage({ params }: Params) {
  const { slug } = await params;
  const client = await prisma.client.findUnique({ where: { slug } });
  if (!client) notFound();

  return (
    <div className="flex flex-col gap-4">
      <Breadcrumbs
        items={[
          { label: "Clients", href: "/clients" },
          { label: client.name, href: `/clients/${client.slug}` },
          { label: "Edit" },
        ]}
      />
      <HudPanel label="Registry" title={`Edit ${client.name}`} className="max-w-3xl">
        <ClientForm
          mode="edit"
          initial={{
            name: client.name,
            slug: client.slug,
            logoUrl: client.logoUrl ?? "",
            contactName: client.contactName ?? "",
            contactEmail: client.contactEmail ?? "",
            notes: client.notes ?? "",
            active: client.active,
          }}
          action={updateClientAction.bind(null, client.id)}
          cancelHref={`/clients/${client.slug}`}
        />
      </HudPanel>
    </div>
  );
}
