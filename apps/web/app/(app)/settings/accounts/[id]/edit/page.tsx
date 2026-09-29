import { prisma } from "@jarvis/db";
import { isConnectableProvider } from "@jarvis/shared";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AccountForm } from "@/components/accounts/account-form";
import { ConfirmDeleteButton } from "@/components/forms/confirm-delete-button";
import { Breadcrumbs } from "@/components/hud/breadcrumbs";
import { HudPanel } from "@/components/hud/hud-panel";
import { deleteAccountAction, updateAccountAction } from "../../actions";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const account = await prisma.providerAccount.findUnique({
    where: { id },
    select: { label: true },
  });
  return { title: account ? `Edit ${account.label}` : "Account not found" };
}

export default async function EditAccountPage({ params }: Params) {
  const { id } = await params;
  const [account, clients] = await Promise.all([
    prisma.providerAccount.findUnique({
      where: { id },
      // hasStoredToken is derived from authType; the ciphertext itself never leaves apps/api.
      select: {
        id: true,
        label: true,
        provider: true,
        authType: true,
        envVarName: true,
        clientId: true,
        _count: { select: { resources: true } },
      },
    }),
    prisma.client.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!account || !isConnectableProvider(account.provider)) notFound();
  const authType = account.authType === "ENCRYPTED_TOKEN" ? "ENCRYPTED_TOKEN" : "ENV_TOKEN";
  const resources = account._count.resources;

  return (
    <div className="flex flex-col gap-4">
      <Breadcrumbs
        items={[
          { label: "Settings", href: "/settings" },
          { label: "Provider accounts", href: "/settings/accounts" },
          { label: account.label, href: `/settings/accounts/${account.id}` },
          { label: "Edit" },
        ]}
      />
      <HudPanel label="Integrations" title={`Edit ${account.label}`} className="max-w-3xl">
        <AccountForm
          mode="edit"
          initial={{
            provider: account.provider,
            label: account.label,
            clientId: account.clientId ?? "",
            authType,
            envVarName: account.envVarName ?? "",
          }}
          clients={clients}
          hasStoredToken={authType === "ENCRYPTED_TOKEN"}
          action={updateAccountAction.bind(null, account.id)}
          cancelHref={`/settings/accounts/${account.id}`}
        />
      </HudPanel>

      <HudPanel label="Danger zone" title="Delete account" tone="muted" className="max-w-3xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {resources > 0
              ? `${resources} resource${resources === 1 ? "" : "s"} still use this account. Delete them first.`
              : "Removes the account and any stored token."}
          </p>
          <ConfirmDeleteButton
            action={deleteAccountAction.bind(null, account.id)}
            confirmText={`Delete ${account.label}? This cannot be undone.`}
          />
        </div>
      </HudPanel>
    </div>
  );
}
