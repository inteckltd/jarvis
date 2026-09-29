import { prisma } from "@jarvis/db";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ConfirmDeleteButton } from "@/components/forms/confirm-delete-button";
import { Breadcrumbs } from "@/components/hud/breadcrumbs";
import { HudPanel } from "@/components/hud/hud-panel";
import { RepositoryForm } from "@/components/repositories/repository-form";
import { deleteRepositoryAction, updateRepositoryAction } from "@/lib/actions/repositories";

type Params = { params: Promise<{ slug: string; repositoryId: string }> };

async function load({ params }: Params) {
  const { slug, repositoryId } = await params;
  return prisma.repository.findFirst({
    where: { id: repositoryId, client: { slug } },
    include: {
      client: { select: { name: true, slug: true } },
      _count: { select: { resources: true } },
    },
  });
}

export async function generateMetadata(props: Params): Promise<Metadata> {
  const repo = await load(props);
  return { title: repo ? `${repo.owner}/${repo.name}` : "Repository not found" };
}

export default async function EditRepositoryPage(props: Params) {
  const repo = await load(props);
  if (!repo) notFound();
  const linked = repo._count.resources;

  return (
    <div className="flex flex-col gap-4">
      <Breadcrumbs
        items={[
          { label: "Clients", href: "/clients" },
          { label: repo.client.name, href: `/clients/${repo.client.slug}` },
          { label: `${repo.owner}/${repo.name}` },
        ]}
      />
      <HudPanel label="GitHub" title="Edit repository" className="max-w-3xl">
        <RepositoryForm
          mode="edit"
          initial={{
            owner: repo.owner,
            name: repo.name,
            productionBranch: repo.productionBranch,
            developmentBranch: repo.developmentBranch ?? "",
            active: repo.active,
          }}
          action={updateRepositoryAction.bind(null, repo.id)}
          cancelHref={`/clients/${repo.client.slug}`}
        />
      </HudPanel>

      <HudPanel label="Danger zone" title="Remove repository" tone="muted" className="max-w-3xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {linked > 0
              ? `${linked} resource${linked === 1 ? " is" : "s are"} linked to it and will be unlinked (not deleted).`
              : "Unlinks it from this client. Nothing on GitHub changes."}
          </p>
          <ConfirmDeleteButton
            action={deleteRepositoryAction.bind(null, repo.id)}
            confirmText={`Remove ${repo.owner}/${repo.name} from ${repo.client.name}?`}
            label="Remove"
          />
        </div>
      </HudPanel>
    </div>
  );
}
