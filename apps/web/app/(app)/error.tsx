"use client";

import { TriangleAlert } from "lucide-react";
import { EmptyState } from "@/components/hud/empty-state";
import { HudPanel } from "@/components/hud/hud-panel";
import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <HudPanel label="Fault detected">
      <EmptyState
        icon={<TriangleAlert />}
        title="Something went wrong loading this page"
        description={
          error.digest ? `Reference: ${error.digest}` : "Check the server logs for details."
        }
        action={
          <Button variant="outline" size="sm" onClick={reset}>
            Try again
          </Button>
        }
      />
    </HudPanel>
  );
}
