import { prisma } from "@jarvis/db";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/hud/breadcrumbs";
import { HudPanel } from "@/components/hud/hud-panel";
import { RepositoryForm } from "@/components/repositories/repository-form";
import { createRepositoryAction } from "@/lib/actions/repositories";

export const metadata: Metadata = { title: "Add repository" };

type Params = { params: Promise<{ slug: string }> };

export default async function NewRepositoryPage({ params }: Params) {
  const { slug } = await params;
  const client = await prisma.client.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      repositories: { select: { owner: true }, take: 1 },
    },
  });
  if (!client) notFound();

  return (
    <div className="flex flex-col gap-4">
      <Breadcrumbs
        items={[
          { label: "Clients", href: "/clients" },
          { label: client.name, href: `/clients/${client.slug}` },
          { label: "Add repository" },
        ]}
      />
      <HudPanel label="GitHub" title="Link a repository" className="max-w-3xl">
        <RepositoryForm
          mode="create"
          initial={{
            owner: client.repositories[0]?.owner ?? "",
            name: "",
            productionBranch: "main",
            developmentBranch: "",
            active: true,
          }}
          action={createRepositoryAction.bind(null, client.id)}
          cancelHref={`/clients/${client.slug}`}
        />
      </HudPanel>
    </div>
  );
}
