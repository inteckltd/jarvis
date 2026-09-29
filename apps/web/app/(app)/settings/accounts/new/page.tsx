import { prisma } from "@jarvis/db";
import { DEFAULT_TOKEN_ENV_VAR } from "@jarvis/shared";
import type { Metadata } from "next";
import { AccountForm } from "@/components/accounts/account-form";
import { Breadcrumbs } from "@/components/hud/breadcrumbs";
import { HudPanel } from "@/components/hud/hud-panel";
import { createAccountAction } from "../actions";

export const metadata: Metadata = { title: "Add provider account" };

export default async function NewAccountPage() {
  const clients = await prisma.client.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="flex flex-col gap-4">
      <Breadcrumbs
        items={[
          { label: "Settings", href: "/settings" },
          { label: "Provider accounts", href: "/settings/accounts" },
          { label: "Add" },
        ]}
      />
      <HudPanel label="Integrations" title="Add provider account" className="max-w-3xl">
        <AccountForm
          mode="create"
          initial={{
            provider: "DIGITALOCEAN",
            label: "Inteck DigitalOcean",
            clientId: "",
            authType: "ENV_TOKEN",
            envVarName: DEFAULT_TOKEN_ENV_VAR.DIGITALOCEAN,
          }}
          clients={clients}
          action={createAccountAction}
          cancelHref="/settings/accounts"
        />
      </HudPanel>
    </div>
  );
}
