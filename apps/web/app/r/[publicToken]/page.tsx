import { prisma } from "@jarvis/db";
import { FileText } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/hud/empty-state";
import { HudPanel } from "@/components/hud/hud-panel";

export const metadata: Metadata = { title: "Report", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Public, read-only client report. Full layout arrives with monthly reports (step 14). */
export default async function PublicReportPage({
  params,
}: {
  params: Promise<{ publicToken: string }>;
}) {
  const { publicToken } = await params;
  if (publicToken.length < 20) notFound();

  const report = await prisma.report.findFirst({
    where: { publicToken, status: "PUBLISHED" },
    select: { month: true, client: { select: { name: true } } },
  });
  if (!report) notFound();

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl items-center p-6">
      <HudPanel className="w-full" label={report.month} title={report.client.name}>
        <EmptyState
          icon={<FileText />}
          title="Monthly report"
          description="Report rendering is not built yet."
        />
      </HudPanel>
    </main>
  );
}
