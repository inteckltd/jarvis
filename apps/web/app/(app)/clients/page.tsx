import { prisma } from "@jarvis/db";
import { Building2 } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/hud/empty-state";
import { HudPanel } from "@/components/hud/hud-panel";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Clients" };

export default async function ClientsPage() {
  const clients = await prisma.client.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      active: true,
      _count: { select: { resources: true, repositories: true } },
    },
  });

  return (
    <HudPanel
      label="Registry"
      title="Clients"
      contentClassName={clients.length ? "p-0" : undefined}
    >
      {clients.length === 0 ? (
        <EmptyState
          icon={<Building2 />}
          title="No clients yet"
          description="Client management arrives in step 3. Run pnpm db:seed to load the IDS pilot."
        />
      ) : (
        <ul className="divide-y divide-border/70">
          {clients.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-4 px-5 py-4">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-primary/40 bg-primary/10 font-display text-xs text-primary">
                  {c.name
                    .split(/\s+/)
                    .map((w) => w[0])
                    .join("")
                    .slice(0, 3)}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-medium">{c.name}</p>
                  <p className="font-mono text-xs text-muted-foreground">{c.slug}</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge variant="outline">{c._count.resources} resources</Badge>
                <Badge variant="outline">{c._count.repositories} repos</Badge>
                {!c.active && <Badge variant="nodata">Inactive</Badge>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </HudPanel>
  );
}
