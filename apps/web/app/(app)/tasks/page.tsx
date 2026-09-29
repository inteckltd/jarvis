import { ListChecks } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/hud/empty-state";
import { HudPanel } from "@/components/hud/hud-panel";

export const metadata: Metadata = { title: "Tasks" };

export default function TasksPage() {
  return (
    <HudPanel label="Operations" title="Tasks">
      <EmptyState
        icon={<ListChecks />}
        title="Task views are coming in step 5"
        description="Quick-add, complete, and Overdue / Today / Upcoming views filtered by client."
      />
    </HudPanel>
  );
}
