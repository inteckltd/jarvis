import type { Metadata } from "next";
import { ClientForm, EMPTY_CLIENT } from "@/components/clients/client-form";
import { Breadcrumbs } from "@/components/hud/breadcrumbs";
import { HudPanel } from "@/components/hud/hud-panel";
import { createClientAction } from "../actions";

export const metadata: Metadata = { title: "New client" };

export default function NewClientPage() {
  return (
    <div className="flex flex-col gap-4">
      <Breadcrumbs items={[{ label: "Clients", href: "/clients" }, { label: "New client" }]} />
      <HudPanel label="Registry" title="New client" className="max-w-3xl">
        <ClientForm
          mode="create"
          initial={EMPTY_CLIENT}
          action={createClientAction}
          cancelHref="/clients"
        />
      </HudPanel>
    </div>
  );
}
