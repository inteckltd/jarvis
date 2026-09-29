"use client";

import { parseRepoRef } from "@jarvis/shared";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";
import { FormAlert, FormField } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { RepositoryFormState } from "@/lib/actions/repositories";

export type RepositoryFormValues = {
  owner: string;
  name: string;
  productionBranch: string;
  developmentBranch: string;
  active: boolean;
};

type Props = {
  mode: "create" | "edit";
  initial: RepositoryFormValues;
  action: (prev: RepositoryFormState, formData: FormData) => Promise<RepositoryFormState>;
  cancelHref: string;
};

const initialState: RepositoryFormState = { status: "idle" };

export function RepositoryForm({ mode, initial, action, cancelHref }: Props) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [values, setValues] = useState(initial);

  const errors = state.status === "error" ? state.fieldErrors : {};
  const set = <K extends keyof RepositoryFormValues>(key: K, value: RepositoryFormValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  // Pasting "owner/name" or a GitHub URL into either field fills both.
  const onRepoText = (key: "owner" | "name", text: string) => {
    const ref = text.includes("/") ? parseRepoRef(text) : null;
    setValues((v) => (ref ? { ...v, owner: ref.owner, name: ref.name } : { ...v, [key]: text }));
  };

  return (
    <form action={formAction} className="flex flex-col gap-6" noValidate>
      <FormAlert message={state.status === "error" ? state.message : null} />

      <div className="grid gap-5 md:grid-cols-2">
        <FormField
          id="owner"
          label="Owner (GitHub org or user)"
          error={errors.owner}
          hint="Paste a GitHub URL to fill both fields."
        >
          <Input
            id="owner"
            name="owner"
            value={values.owner}
            onChange={(e) => onRepoText("owner", e.target.value)}
            placeholder="industrial-door-systems"
            className="font-mono"
            autoComplete="off"
            spellCheck={false}
            autoFocus={mode === "create"}
            aria-invalid={Boolean(errors.owner) || undefined}
          />
        </FormField>
        <FormField id="name" label="Repository" error={errors.name}>
          <Input
            id="name"
            name="name"
            value={values.name}
            onChange={(e) => onRepoText("name", e.target.value)}
            placeholder="ids.workforce-api"
            className="font-mono"
            autoComplete="off"
            spellCheck={false}
            aria-invalid={Boolean(errors.name) || undefined}
          />
        </FormField>
        <FormField
          id="productionBranch"
          label="Production branch"
          error={errors.productionBranch}
          hint="Merges here count as released to production."
        >
          <Input
            id="productionBranch"
            name="productionBranch"
            value={values.productionBranch}
            onChange={(e) => set("productionBranch", e.target.value)}
            className="font-mono"
            autoComplete="off"
            aria-invalid={Boolean(errors.productionBranch) || undefined}
          />
        </FormField>
        <FormField
          id="developmentBranch"
          label="Development branch (optional)"
          error={errors.developmentBranch}
          hint="Commits here but not in production are 'awaiting production'."
        >
          <Input
            id="developmentBranch"
            name="developmentBranch"
            value={values.developmentBranch}
            onChange={(e) => set("developmentBranch", e.target.value)}
            placeholder="pre-production"
            className="font-mono"
            autoComplete="off"
            aria-invalid={Boolean(errors.developmentBranch) || undefined}
          />
        </FormField>

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
              Inactive repositories are ignored by GitHub activity and release tracking.
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
          {mode === "create" ? "Add repository" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
