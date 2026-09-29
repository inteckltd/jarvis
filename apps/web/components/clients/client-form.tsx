"use client";

import { type ClientField, slugify } from "@jarvis/shared";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useActionState, useState } from "react";
import type { ClientFormState } from "@/app/(app)/clients/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export type ClientFormValues = {
  name: string;
  slug: string;
  logoUrl: string;
  contactName: string;
  contactEmail: string;
  notes: string;
  active: boolean;
};

export const EMPTY_CLIENT: ClientFormValues = {
  name: "",
  slug: "",
  logoUrl: "",
  contactName: "",
  contactEmail: "",
  notes: "",
  active: true,
};

type Props = {
  mode: "create" | "edit";
  initial: ClientFormValues;
  action: (prev: ClientFormState, formData: FormData) => Promise<ClientFormState>;
  cancelHref: string;
};

const initialState: ClientFormState = { status: "idle" };

export function ClientForm({ mode, initial, action, cancelHref }: Props) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [values, setValues] = useState(initial);
  // New clients get a slug derived from the name until the slug is edited by hand.
  const [slugTouched, setSlugTouched] = useState(mode === "edit");

  const errors = state.status === "error" ? state.fieldErrors : {};
  const set = <K extends keyof ClientFormValues>(key: K, value: ClientFormValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  const onNameChange = (name: string) =>
    setValues((v) => ({ ...v, name, slug: slugTouched ? v.slug : slugify(name) }));

  return (
    <form action={formAction} className="flex flex-col gap-6" noValidate>
      {state.status === "error" && state.message && (
        <p
          className="rounded-md border border-status-critical/40 bg-status-critical/10 px-3 py-2 text-sm text-status-critical"
          role="alert"
        >
          {state.message}
        </p>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        <Field id="name" label="Name" error={errors.name}>
          <Input
            id="name"
            name="name"
            value={values.name}
            onChange={(e) => onNameChange(e.target.value)}
            required
            autoFocus={mode === "create"}
            placeholder="Industrial Door Systems"
            aria-invalid={Boolean(errors.name) || undefined}
          />
        </Field>

        <Field id="slug" label="Slug" error={errors.slug} hint={`/clients/${values.slug || "…"}`}>
          <Input
            id="slug"
            name="slug"
            value={values.slug}
            onChange={(e) => {
              setSlugTouched(true);
              set("slug", e.target.value.toLowerCase());
            }}
            required
            className="font-mono"
            placeholder="industrial-door-systems"
            aria-invalid={Boolean(errors.slug) || undefined}
          />
        </Field>

        <Field id="contactName" label="Contact name" error={errors.contactName}>
          <Input
            id="contactName"
            name="contactName"
            value={values.contactName}
            onChange={(e) => set("contactName", e.target.value)}
            autoComplete="off"
            aria-invalid={Boolean(errors.contactName) || undefined}
          />
        </Field>

        <Field id="contactEmail" label="Contact email" error={errors.contactEmail}>
          <Input
            id="contactEmail"
            name="contactEmail"
            type="email"
            value={values.contactEmail}
            onChange={(e) => set("contactEmail", e.target.value)}
            autoComplete="off"
            aria-invalid={Boolean(errors.contactEmail) || undefined}
          />
        </Field>

        <Field
          id="logoUrl"
          label="Logo URL"
          error={errors.logoUrl}
          hint="Used on reports. Square images on a light background work best."
          className="md:col-span-2"
        >
          <Input
            id="logoUrl"
            name="logoUrl"
            type="url"
            value={values.logoUrl}
            onChange={(e) => set("logoUrl", e.target.value)}
            placeholder="https://…"
            aria-invalid={Boolean(errors.logoUrl) || undefined}
          />
        </Field>

        <Field
          id="notes"
          label="Notes"
          error={errors.notes}
          hint="Internal only."
          className="md:col-span-2"
        >
          <Textarea
            id="notes"
            name="notes"
            value={values.notes}
            onChange={(e) => set("notes", e.target.value)}
            rows={4}
            aria-invalid={Boolean(errors.notes) || undefined}
          />
        </Field>

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
              Inactive clients are kept for history but hidden from the morning briefing.
            </span>
          </span>
        </label>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-border/70 pt-5">
        <Button asChild variant="ghost">
          <Link href={cancelHref}>Cancel</Link>
        </Button>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          {mode === "create" ? "Create client" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}

function Field({
  id,
  label,
  error,
  hint,
  className,
  children,
}: {
  id: ClientField;
  label: string;
  error?: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p className="text-xs text-status-critical" id={`${id}-error`}>
          {error}
        </p>
      ) : (
        hint && <p className="font-mono text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}
