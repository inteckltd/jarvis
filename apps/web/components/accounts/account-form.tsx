"use client";

import {
  CONNECTABLE_PROVIDERS,
  type ConnectableProvider,
  DEFAULT_TOKEN_ENV_VAR,
  type TokenAuthType,
  vercelTeamEnvVar,
} from "@jarvis/shared";
import { KeyRound, Loader2, Variable } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useActionState, useState } from "react";
import type { AccountFormState } from "@/app/(app)/settings/accounts/actions";
import { FormAlert, FormField } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { PROVIDER_LABEL } from "@/lib/labels";
import { cn } from "@/lib/utils";

export type AccountFormValues = {
  provider: ConnectableProvider;
  label: string;
  clientId: string;
  authType: TokenAuthType;
  envVarName: string;
};

type Props = {
  mode: "create" | "edit";
  initial: AccountFormValues;
  clients: readonly { id: string; name: string }[];
  /** The owner is fixed (connecting a client's own account from the client page). */
  fixedOwner?: { id: string; name: string };
  /** Edit mode: an encrypted token is already stored. */
  hasStoredToken?: boolean;
  action: (prev: AccountFormState, formData: FormData) => Promise<AccountFormState>;
  cancelHref: string;
};

const initialState: AccountFormState = { status: "idle" };

const defaultLabel = (owner: string, provider: ConnectableProvider) =>
  `${owner} ${PROVIDER_LABEL[provider]}`;

export function AccountForm({
  mode,
  initial,
  clients,
  fixedOwner,
  hasStoredToken = false,
  action,
  cancelHref,
}: Props) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [values, setValues] = useState(initial);
  const [labelTouched, setLabelTouched] = useState(mode === "edit");
  const [envTouched, setEnvTouched] = useState(mode === "edit");

  const errors = state.status === "error" ? state.fieldErrors : {};
  const set = <K extends keyof AccountFormValues>(key: K, value: AccountFormValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  const onProviderChange = (provider: ConnectableProvider) =>
    setValues((v) => ({
      ...v,
      provider,
      label: labelTouched ? v.label : defaultLabel(fixedOwner?.name ?? "Inteck", provider),
      envVarName: envTouched ? v.envVarName : DEFAULT_TOKEN_ENV_VAR[provider],
    }));

  return (
    <form action={formAction} className="flex flex-col gap-6" noValidate>
      <FormAlert message={state.status === "error" ? state.message : null} />

      <div className="grid gap-5 md:grid-cols-2">
        <FormField
          id="provider"
          label="Provider"
          error={errors.provider}
          hint={mode === "edit" ? "The provider of an existing account can't change." : undefined}
        >
          <NativeSelect
            id="provider"
            name="provider"
            value={values.provider}
            disabled={mode === "edit"}
            onChange={(e) => onProviderChange(e.target.value as ConnectableProvider)}
          >
            {CONNECTABLE_PROVIDERS.map((p) => (
              <option key={p} value={p}>
                {PROVIDER_LABEL[p]}
              </option>
            ))}
          </NativeSelect>
          {mode === "edit" && <input type="hidden" name="provider" value={values.provider} />}
        </FormField>

        <FormField id="label" label="Label" error={errors.label}>
          <Input
            id="label"
            name="label"
            value={values.label}
            onChange={(e) => {
              setLabelTouched(true);
              set("label", e.target.value);
            }}
            autoComplete="off"
            aria-invalid={Boolean(errors.label) || undefined}
          />
        </FormField>

        <FormField
          id="clientId"
          label="Owned by"
          error={errors.clientId}
          hint={
            fixedOwner
              ? `Only ${fixedOwner.name}'s resources can use this account.`
              : "Inteck-owned accounts can hold resources for any client."
          }
          className="md:col-span-2"
        >
          {fixedOwner ? (
            <>
              <Input id="clientId" value={fixedOwner.name} readOnly disabled />
              <input type="hidden" name="clientId" value={fixedOwner.id} />
            </>
          ) : (
            <NativeSelect
              id="clientId"
              name="clientId"
              value={values.clientId}
              onChange={(e) => set("clientId", e.target.value)}
            >
              <option value="">Inteck</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </NativeSelect>
          )}
        </FormField>
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-sm font-medium">Token</legend>
        <input type="hidden" name="authType" value={values.authType} />
        <div className="grid gap-3 md:grid-cols-2">
          <AuthOption
            selected={values.authType === "ENV_TOKEN"}
            onSelect={() => set("authType", "ENV_TOKEN")}
            icon={<Variable />}
            title="Environment variable"
            description="Recommended for Inteck-owned accounts. The token stays in the API's environment."
          />
          <AuthOption
            selected={values.authType === "ENCRYPTED_TOKEN"}
            onSelect={() => set("authType", "ENCRYPTED_TOKEN")}
            icon={<KeyRound />}
            title="Stored, encrypted"
            description="For client-owned accounts. Encrypted with ENCRYPTION_KEY by the API."
          />
        </div>

        {values.authType === "ENV_TOKEN" ? (
          <FormField
            id="envVarName"
            label="Env var name"
            error={errors.envVarName}
            hint={
              values.provider === "VERCEL"
                ? `Set in the root .env. Optional team: ${vercelTeamEnvVar(values.envVarName || "VERCEL_TOKEN")}`
                : `Set in the root .env. Extra accounts: ${DEFAULT_TOKEN_ENV_VAR[values.provider]}_<NAME>`
            }
          >
            <Input
              id="envVarName"
              name="envVarName"
              value={values.envVarName}
              onChange={(e) => {
                setEnvTouched(true);
                set("envVarName", e.target.value.toUpperCase());
              }}
              className="font-mono"
              autoComplete="off"
              spellCheck={false}
              aria-invalid={Boolean(errors.envVarName) || undefined}
            />
          </FormField>
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            <FormField
              id="token"
              label="API token"
              error={errors.token}
              hint={
                hasStoredToken
                  ? "A token is stored. Leave blank to keep it."
                  : "Sent to the API and encrypted; never shown again."
              }
              className={values.provider === "VERCEL" ? undefined : "md:col-span-2"}
            >
              <Input
                id="token"
                name="token"
                type="password"
                autoComplete="off"
                spellCheck={false}
                className="font-mono"
                placeholder={hasStoredToken ? "••••••••" : undefined}
                aria-invalid={Boolean(errors.token) || undefined}
              />
            </FormField>
            {values.provider === "VERCEL" && (
              <FormField
                id="teamId"
                label="Team ID (optional)"
                error={errors.teamId}
                hint={
                  hasStoredToken
                    ? "Saved with the token; re-enter the token to change it."
                    : "For team-owned projects, e.g. team_…"
                }
              >
                <Input id="teamId" name="teamId" autoComplete="off" className="font-mono" />
              </FormField>
            )}
          </div>
        )}
      </fieldset>

      <div className="flex items-center justify-end gap-2 border-t border-border/70 pt-5">
        <Button asChild variant="ghost">
          <Link href={cancelHref}>Cancel</Link>
        </Button>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          {mode === "create" ? "Add account" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}

function AuthOption({
  selected,
  onSelect,
  icon,
  title,
  description,
}: {
  selected: boolean;
  onSelect: () => void;
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "flex items-start gap-3 rounded-md border p-3 text-left transition-colors [&_svg]:size-4 [&_svg]:shrink-0",
        selected
          ? "border-primary/60 bg-primary/10 shadow-[0_0_18px_-8px_var(--glow)]"
          : "border-border/70 hover:border-primary/40",
      )}
    >
      <span className={cn("mt-0.5", selected ? "text-primary" : "text-muted-foreground")}>
        {icon}
      </span>
      <span className="space-y-0.5">
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-xs text-muted-foreground">{description}</span>
      </span>
    </button>
  );
}
