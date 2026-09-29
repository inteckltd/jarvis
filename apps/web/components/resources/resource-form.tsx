"use client";

import {
  defaultHealthCheckUrl,
  ENVIRONMENTS,
  type EnvironmentName,
  type ProviderName,
  RESOURCE_TYPE_PROVIDER,
  RESOURCE_TYPES,
  type ResourceTypeName,
} from "@jarvis/shared";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { FormAlert, FormField } from "@/components/forms/form-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import type { ResourceFormState } from "@/lib/actions/resources";
import { ENVIRONMENT_LABEL, PROVIDER_LABEL, RESOURCE_TYPE_LABEL } from "@/lib/labels";
import { cn } from "@/lib/utils";

export type ResourceFormValues = {
  clientId: string;
  providerAccountId: string;
  type: ResourceTypeName;
  externalId: string;
  name: string;
  environment: EnvironmentName;
  region: string;
  liveUrl: string;
  healthCheckUrl: string;
  repositoryId: string;
  active: boolean;
  config: Record<string, string>;
};

export type ResourceFormClient = {
  id: string;
  name: string;
  repositories: readonly {
    id: string;
    owner: string;
    name: string;
    productionBranch: string;
    developmentBranch: string | null;
  }[];
};

export type ResourceFormAccount = {
  id: string;
  label: string;
  provider: ProviderName;
  clientId: string | null;
};

type Props = {
  /** create: pick account/type/ID by hand. import: identity comes from discovery. edit: identity is fixed. */
  mode: "create" | "import" | "edit";
  initial: ResourceFormValues;
  clients: readonly ResourceFormClient[];
  accounts: readonly ResourceFormAccount[];
  /** DO: the app's components, for choosing the primary one. */
  components?: readonly string[];
  /** Fallback production branch reported by the provider (Vercel). */
  providerBranch?: string | null;
  action: (prev: ResourceFormState, formData: FormData) => Promise<ResourceFormState>;
  onSaved?: (state: Extract<ResourceFormState, { status: "saved" }>) => void;
  cancel: { href: string } | { onClick: () => void };
};

const initialState: ResourceFormState = { status: "idle" };

const CONNECTABLE_TYPES = RESOURCE_TYPES.filter((t) => t !== "AWS_EC2");

export function vercelBranchFor(
  environment: EnvironmentName,
  repo: ResourceFormClient["repositories"][number] | undefined,
  providerBranch: string | null | undefined,
): { target: string; branch: string } {
  return environment === "DEVELOPMENT"
    ? { target: "preview", branch: repo?.developmentBranch ?? "pre-production" }
    : { target: "production", branch: repo?.productionBranch ?? providerBranch ?? "main" };
}

export function ResourceForm({
  mode,
  initial,
  clients,
  accounts,
  components = [],
  providerBranch,
  action,
  onSaved,
  cancel,
}: Props) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [values, setValues] = useState(initial);
  const [healthTouched, setHealthTouched] = useState(
    mode === "edit" || initial.healthCheckUrl !== "",
  );
  const [branchTouched, setBranchTouched] = useState(mode === "edit");

  const errors = state.status === "error" ? state.fieldErrors : {};
  const client = clients.find((c) => c.id === values.clientId);
  const account = accounts.find((a) => a.id === values.providerAccountId);
  const repos = client?.repositories ?? [];

  const lastSaved = useRef<ResourceFormState | null>(null);
  useEffect(() => {
    if (state.status === "saved" && lastSaved.current !== state) {
      lastSaved.current = state;
      onSaved?.(state);
    }
  }, [state, onSaved]);

  const typeOptions = useMemo(
    () =>
      account
        ? CONNECTABLE_TYPES.filter((t) => RESOURCE_TYPE_PROVIDER[t] === account.provider)
        : CONNECTABLE_TYPES,
    [account],
  );

  const set = <K extends keyof ResourceFormValues>(key: K, value: ResourceFormValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));
  const setConfig = (key: string, value: string) =>
    setValues((v) => ({ ...v, config: { ...v.config, [key]: value } }));

  /** Re-derive Vercel's tracked branch/target from environment + repository unless edited by hand. */
  const withVercelDefaults = (v: ResourceFormValues): ResourceFormValues => {
    if (v.type !== "VERCEL_PROJECT" || branchTouched) return v;
    const repo = clients
      .find((c) => c.id === v.clientId)
      ?.repositories.find((r) => r.id === v.repositoryId);
    return {
      ...v,
      config: { ...v.config, ...vercelBranchFor(v.environment, repo, providerBranch) },
    };
  };

  const onEnvironment = (environment: EnvironmentName) =>
    setValues((v) => withVercelDefaults({ ...v, environment }));

  const onRepository = (repositoryId: string) =>
    setValues((v) => withVercelDefaults({ ...v, repositoryId }));

  const onClient = (clientId: string) =>
    setValues((v) => withVercelDefaults({ ...v, clientId, repositoryId: "" }));

  const onLiveUrl = (liveUrl: string) =>
    setValues((v) => ({
      ...v,
      liveUrl,
      healthCheckUrl: healthTouched
        ? v.healthCheckUrl
        : (defaultHealthCheckUrl(v.type, liveUrl.trim()) ?? ""),
    }));

  const onAccount = (providerAccountId: string) => {
    const next = accounts.find((a) => a.id === providerAccountId);
    setValues((v) => {
      const keepType = next && RESOURCE_TYPE_PROVIDER[v.type] === next.provider;
      const type =
        keepType || !next
          ? v.type
          : (CONNECTABLE_TYPES.find((t) => RESOURCE_TYPE_PROVIDER[t] === next.provider) ?? v.type);
      return { ...v, providerAccountId, type };
    });
  };

  const identityLocked = mode !== "create";

  return (
    <form action={formAction} className="flex flex-col gap-6" noValidate>
      <FormAlert message={state.status === "error" ? state.message : null} />

      {identityLocked ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-border/70 bg-background/40 px-3 py-2.5 text-xs">
          <Badge variant="outline">{RESOURCE_TYPE_LABEL[values.type]}</Badge>
          <span className="text-muted-foreground">
            {account ? `${PROVIDER_LABEL[account.provider]} · ${account.label}` : "Unknown account"}
          </span>
          <span
            className="min-w-0 truncate font-mono text-muted-foreground"
            title={values.externalId}
          >
            {values.externalId}
          </span>
          <input type="hidden" name="providerAccountId" value={values.providerAccountId} />
          <input type="hidden" name="type" value={values.type} />
          <input type="hidden" name="externalId" value={values.externalId} />
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          <FormField
            id="providerAccountId"
            label="Provider account"
            error={errors.providerAccountId}
          >
            <NativeSelect
              id="providerAccountId"
              name="providerAccountId"
              value={values.providerAccountId}
              onChange={(e) => onAccount(e.target.value)}
              aria-invalid={Boolean(errors.providerAccountId) || undefined}
            >
              <option value="">Choose an account…</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {PROVIDER_LABEL[a.provider]} · {a.label}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField id="type" label="Type" error={errors.type}>
            <NativeSelect
              id="type"
              name="type"
              value={values.type}
              onChange={(e) => set("type", e.target.value as ResourceTypeName)}
            >
              {typeOptions.map((t) => (
                <option key={t} value={t}>
                  {RESOURCE_TYPE_LABEL[t]}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField
            id="externalId"
            label="External ID"
            error={errors.externalId}
            hint="DO app ID, Supabase project ref, Vercel project ID or Expo project ID"
            className="md:col-span-2"
          >
            <Input
              id="externalId"
              name="externalId"
              value={values.externalId}
              onChange={(e) => set("externalId", e.target.value)}
              className="font-mono"
              autoComplete="off"
              spellCheck={false}
              aria-invalid={Boolean(errors.externalId) || undefined}
            />
          </FormField>
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        {clients.length > 1 ? (
          <FormField id="clientId" label="Client" error={errors.clientId}>
            <NativeSelect
              id="clientId"
              name="clientId"
              value={values.clientId}
              onChange={(e) => onClient(e.target.value)}
              aria-invalid={Boolean(errors.clientId) || undefined}
            >
              <option value="">Choose a client…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </NativeSelect>
          </FormField>
        ) : (
          <FormField id="clientName" label="Client" error={errors.clientId}>
            <Input id="clientName" value={client?.name ?? ""} readOnly disabled />
            <input type="hidden" name="clientId" value={values.clientId} />
          </FormField>
        )}

        <FormField id="name" label="Name" error={errors.name}>
          <Input
            id="name"
            name="name"
            value={values.name}
            onChange={(e) => set("name", e.target.value)}
            autoComplete="off"
            aria-invalid={Boolean(errors.name) || undefined}
          />
        </FormField>

        <FormField
          id="environment"
          label="Environment"
          error={errors.environment}
          hint="Production drives the client's status. Development is shown quietly."
          className="md:col-span-2"
        >
          <input type="hidden" name="environment" value={values.environment} />
          <div role="radiogroup" aria-labelledby="environment" className="grid grid-cols-3 gap-2">
            {ENVIRONMENTS.map((env) => (
              <button
                key={env}
                type="button"
                role="radio"
                aria-checked={values.environment === env}
                onClick={() => onEnvironment(env)}
                className={cn(
                  "rounded-md border px-3 py-2 text-sm transition-colors",
                  values.environment === env
                    ? env === "PRODUCTION"
                      ? "border-primary/60 bg-primary/10 text-primary shadow-[0_0_18px_-8px_var(--glow)]"
                      : "border-border bg-secondary text-foreground"
                    : "border-border/60 text-muted-foreground hover:border-primary/40",
                )}
              >
                {env === "NONE" ? "None" : ENVIRONMENT_LABEL[env]}
              </button>
            ))}
          </div>
        </FormField>

        <FormField
          id="repositoryId"
          label="Repository"
          error={errors.repositoryId}
          hint={
            repos.length === 0
              ? "This client has no repositories yet. Add them on the client page."
              : undefined
          }
          className="md:col-span-2"
        >
          <NativeSelect
            id="repositoryId"
            name="repositoryId"
            value={values.repositoryId}
            onChange={(e) => onRepository(e.target.value)}
            disabled={repos.length === 0}
          >
            <option value="">None</option>
            {repos.map((r) => (
              <option key={r.id} value={r.id}>
                {r.owner}/{r.name}
              </option>
            ))}
          </NativeSelect>
          {repos.length === 0 && <input type="hidden" name="repositoryId" value="" />}
        </FormField>

        <FormField id="liveUrl" label="Live URL" error={errors.liveUrl}>
          <Input
            id="liveUrl"
            name="liveUrl"
            type="url"
            value={values.liveUrl}
            onChange={(e) => onLiveUrl(e.target.value)}
            placeholder="https://…"
            className="font-mono"
            aria-invalid={Boolean(errors.liveUrl) || undefined}
          />
        </FormField>

        <FormField
          id="healthCheckUrl"
          label="Health check URL"
          error={errors.healthCheckUrl}
          hint="Falls back to the live URL if /health isn't there yet."
        >
          <Input
            id="healthCheckUrl"
            name="healthCheckUrl"
            type="url"
            value={values.healthCheckUrl}
            onChange={(e) => {
              setHealthTouched(true);
              set("healthCheckUrl", e.target.value);
            }}
            placeholder="https://…/health"
            className="font-mono"
            aria-invalid={Boolean(errors.healthCheckUrl) || undefined}
          />
        </FormField>

        <FormField id="region" label="Region" error={errors.region}>
          <Input
            id="region"
            name="region"
            value={values.region}
            onChange={(e) => set("region", e.target.value)}
            className="font-mono"
            autoComplete="off"
          />
        </FormField>

        <ConfigFields
          type={values.type}
          config={values.config}
          errors={errors}
          components={components}
          onChange={setConfig}
          onBranchTouched={() => setBranchTouched(true)}
        />

        <label className="flex cursor-pointer items-start gap-3 md:col-span-2">
          <input
            type="checkbox"
            name="active"
            checked={values.active}
            onChange={(e) => set("active", e.target.checked)}
            className="mt-0.5 size-4 accent-primary"
          />
          <span className="space-y-0.5">
            <span className="block text-sm font-medium">Active</span>
            <span className="block text-xs text-muted-foreground">
              Inactive resources are kept for history but not monitored.
            </span>
          </span>
        </label>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-border/70 pt-5">
        {"href" in cancel ? (
          <Button asChild variant="ghost">
            <Link href={cancel.href}>Cancel</Link>
          </Button>
        ) : (
          <Button type="button" variant="ghost" onClick={cancel.onClick}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          {mode === "edit"
            ? "Save changes"
            : mode === "import"
              ? "Import resource"
              : "Add resource"}
        </Button>
      </div>
    </form>
  );
}

function ConfigFields({
  type,
  config,
  errors,
  components,
  onChange,
  onBranchTouched,
}: {
  type: ResourceTypeName;
  config: Record<string, string>;
  errors: Record<string, string>;
  components: readonly string[];
  onChange: (key: string, value: string) => void;
  onBranchTouched: () => void;
}) {
  const field = (key: string) => ({
    id: `config.${key}`,
    name: `config.${key}`,
    value: config[key] ?? "",
    "aria-invalid": Boolean(errors[`config.${key}`]) || undefined,
  });

  switch (type) {
    case "DO_APP":
      return (
        <FormField
          id="config.componentName"
          label="Component"
          error={errors["config.componentName"]}
          hint="The service whose CPU, memory and restarts are tracked."
        >
          {components.length > 0 ? (
            <NativeSelect
              {...field("componentName")}
              onChange={(e) => onChange("componentName", e.target.value)}
            >
              {components.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </NativeSelect>
          ) : (
            <Input
              {...field("componentName")}
              onChange={(e) => onChange("componentName", e.target.value)}
              className="font-mono"
              autoComplete="off"
            />
          )}
        </FormField>
      );
    case "VERCEL_PROJECT":
      return (
        <>
          <FormField id="config.target" label="Deployment target" error={errors["config.target"]}>
            <NativeSelect
              {...field("target")}
              onChange={(e) => {
                onBranchTouched();
                onChange("target", e.target.value);
              }}
            >
              <option value="production">Production</option>
              <option value="preview">Preview</option>
            </NativeSelect>
          </FormField>
          <FormField
            id="config.branch"
            label="Tracked branch"
            error={errors["config.branch"]}
            hint="Deployments from this branch belong to this resource."
          >
            <Input
              {...field("branch")}
              onChange={(e) => {
                onBranchTouched();
                onChange("branch", e.target.value);
              }}
              className="font-mono"
              autoComplete="off"
            />
          </FormField>
        </>
      );
    case "EXPO_APP":
      return (
        <>
          <FormField
            id="config.bundleId"
            label="iOS bundle ID"
            error={errors["config.bundleId"]}
            hint="Used to look up the App Store version."
          >
            <Input
              {...field("bundleId")}
              onChange={(e) => onChange("bundleId", e.target.value)}
              className="font-mono"
              autoComplete="off"
            />
          </FormField>
          <FormField
            id="config.iosAppId"
            label="App Store app ID"
            error={errors["config.iosAppId"]}
          >
            <Input
              {...field("iosAppId")}
              onChange={(e) => onChange("iosAppId", e.target.value)}
              className="font-mono"
              autoComplete="off"
            />
          </FormField>
          <FormField
            id="config.androidPackage"
            label="Android package"
            error={errors["config.androidPackage"]}
            className="md:col-span-2"
          >
            <Input
              {...field("androidPackage")}
              onChange={(e) => onChange("androidPackage", e.target.value)}
              className="font-mono"
              autoComplete="off"
            />
          </FormField>
        </>
      );
    default:
      return null;
  }
}
