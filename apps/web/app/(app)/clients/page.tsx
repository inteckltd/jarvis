import { prisma } from "@jarvis/db";
import { Building2, ChevronRight, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ClientAvatar } from "@/components/clients/client-avatar";
import { EmptyState } from "@/components/hud/empty-state";
import { HudPanel } from "@/components/hud/hud-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Clients" };

export default async function ClientsPage() {
  const clients = await prisma.client.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      logoUrl: true,
      contactName: true,
      contactEmail: true,
      active: true,
      resources: { where: { active: true }, select: { environment: true } },
      _count: { select: { repositories: true } },
    },
  });

  const newButton = (
    <Button asChild size="sm">
      <Link href="/clients/new">
        <Plus />
        New client
      </Link>
    </Button>
  );

  return (
    <HudPanel
      label="Registry"
      title={`Clients${clients.length ? ` · ${clients.length}` : ""}`}
      actions={newButton}
      contentClassName={clients.length ? "p-0" : undefined}
    >
      {clients.length === 0 ? (
        <EmptyState
          icon={<Building2 />}
          title="No clients yet"
          description="Add your first client, then connect its provider accounts and resources."
          action={newButton}
        />
      ) : (
        <ul className="divide-y divide-border/70">
          {clients.map((c) => {
            const prod = c.resources.filter((r) => r.environment === "PRODUCTION").length;
            const dev = c.resources.filter((r) => r.environment === "DEVELOPMENT").length;
            return (
              <li key={c.id}>
                <Link
                  href={`/clients/${c.slug}`}
                  className={cn(
                    "group flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-primary/5",
                    !c.active && "opacity-60",
                  )}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <ClientAvatar name={c.name} logoUrl={c.logoUrl} />
                    <div className="min-w-0">
                      <p className="truncate font-medium group-hover:text-primary">{c.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        <span className="font-mono">{c.slug}</span>
                        {(c.contactName ?? c.contactEmail) && (
                          <span className="hidden sm:inline">
                            {" "}
                            · {c.contactName ?? c.contactEmail}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <div className="hidden items-center gap-2 md:flex">
                      <Badge variant="outline">{prod} prod</Badge>
                      <Badge variant="outline">{dev} dev</Badge>
                      <Badge variant="outline">{c._count.repositories} repos</Badge>
                    </div>
                    {!c.active && <Badge variant="nodata">Inactive</Badge>}
                    <ChevronRight className="size-4 text-muted-foreground group-hover:text-primary" />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </HudPanel>
  );
}
