import { FileText } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/hud/empty-state";
import { HudPanel } from "@/components/hud/hud-panel";

export const metadata: Metadata = { title: "Reports" };

export default function ReportsPage() {
  return (
    <HudPanel label="Client-facing" title="Monthly reports">
      <EmptyState
        icon={<FileText />}
        title="Reports are coming in step 14"
        description="Aggregate a client's month, edit the summary, publish a public link and PDF."
      />
    </HudPanel>
  );
}
