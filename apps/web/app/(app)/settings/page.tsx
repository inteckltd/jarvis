import { DEFAULT_THRESHOLDS, RESTART_THRESHOLDS, TIMEZONE } from "@jarvis/shared";
import type { Metadata } from "next";
import type * as React from "react";
import { z } from "zod";
import { HudPanel } from "@/components/hud/hud-panel";
import { StatusDot } from "@/components/hud/status-dot";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { serverEnv } from "@/lib/env";

export const metadata: Metadata = { title: "Settings" };

const meSchema = z.object({ sub: z.string(), email: z.string() });

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

export default async function SettingsPage() {
  const [user, api] = await Promise.all([requireUser(), apiFetch("/v1/me", meSchema)]);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <HudPanel
        label="Link status"
        title="Jarvis API"
        actions={
          <Badge variant={api.ok ? "healthy" : "critical"}>
            <StatusDot
              status={api.ok ? "healthy" : "critical"}
              className="size-1.5 [&>span]:size-1.5"
            />
            {api.ok ? "Connected" : "Error"}
          </Badge>
        }
      >
        <dl className="divide-y divide-border/70">
          <Row label="Endpoint">
            <span className="font-mono">{serverEnv().API_URL}</span>
          </Row>
          <Row label="Verified identity">
            {api.ok ? (
              <span className="font-mono">{api.data.email}</span>
            ) : (
              <span className="text-status-critical">{api.error}</span>
            )}
          </Row>
        </dl>
      </HudPanel>

      <HudPanel label="Account" title="Signed in">
        <dl className="divide-y divide-border/70">
          <Row label="Email">
            <span className="font-mono">{user.email}</span>
          </Row>
          <Row label="Display timezone">
            <span className="font-mono">{TIMEZONE}</span>
          </Row>
        </dl>
      </HudPanel>

      <HudPanel label="Defaults" title="Alert thresholds" className="lg:col-span-2" corners={false}>
        <dl className="divide-y divide-border/70">
          <Row label="CPU / memory / disk warning">
            <span className="font-mono text-status-warning">≥ {DEFAULT_THRESHOLDS.warning}%</span>
          </Row>
          <Row label="CPU / memory / disk critical">
            <span className="font-mono text-status-critical">≥ {DEFAULT_THRESHOLDS.critical}%</span>
          </Row>
          <Row label={`Production restarts (${RESTART_THRESHOLDS.windowHours}h)`}>
            <span className="font-mono">
              <span className="text-status-warning">≥ {RESTART_THRESHOLDS.warning} amber</span>
              {" · "}
              <span className="text-status-critical">≥ {RESTART_THRESHOLDS.critical} red</span>
            </span>
          </Row>
        </dl>
        <p className="mt-3 text-xs text-muted-foreground">
          Provider accounts and per-client settings arrive in step 4.
        </p>
      </HudPanel>
    </div>
  );
}
