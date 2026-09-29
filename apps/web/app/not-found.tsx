import { Radar } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/hud/empty-state";
import { HudPanel } from "@/components/hud/hud-panel";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <HudPanel className="w-full max-w-md" label="Signal lost">
        <EmptyState
          icon={<Radar />}
          title="Page not found"
          description="Nothing is registered at this address."
          action={
            <Button asChild variant="outline" size="sm">
              <Link href="/">Back to briefing</Link>
            </Button>
          }
        />
      </HudPanel>
    </main>
  );
}
