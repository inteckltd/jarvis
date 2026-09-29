"use client";

import { Loader2 } from "lucide-react";
import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { FormAlert, FormField } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { TaskFormState } from "@/lib/actions/tasks";
import type { TaskClientOption } from "./quick-add-task";

export type TaskFormValues = {
  title: string;
  clientId: string;
  dueDate: string;
  description: string;
};

type Props = {
  initial: TaskFormValues;
  clients: TaskClientOption[];
  action: (prev: TaskFormState, formData: FormData) => Promise<TaskFormState>;
};

const initialState: TaskFormState = { status: "idle" };

export function TaskForm({ initial, clients, action }: Props) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const errors = state.status === "error" ? state.fieldErrors : {};

  useEffect(() => {
    if (state.status === "saved") toast.success("Task saved");
  }, [state]);

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <FormAlert message={state.status === "error" ? state.message : null} />

      <FormField id="title" label="Title" error={errors.title}>
        <Input
          id="title"
          name="title"
          defaultValue={initial.title}
          maxLength={200}
          autoComplete="off"
          aria-invalid={Boolean(errors.title) || undefined}
        />
      </FormField>

      <div className="grid gap-5 sm:grid-cols-2">
        <FormField id="clientId" label="Client" error={errors.clientId}>
          <NativeSelect
            id="clientId"
            name="clientId"
            defaultValue={initial.clientId}
            aria-invalid={Boolean(errors.clientId) || undefined}
          >
            <option value="">Internal (Inteck)</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField id="dueDate" label="Due date" error={errors.dueDate}>
          <Input
            id="dueDate"
            type="date"
            name="dueDate"
            defaultValue={initial.dueDate}
            className="font-mono [color-scheme:dark]"
            aria-invalid={Boolean(errors.dueDate) || undefined}
          />
        </FormField>
      </div>

      <FormField
        id="description"
        label="Description"
        error={errors.description}
        hint="Plain text. Details, links, acceptance notes."
      >
        <Textarea
          id="description"
          name="description"
          defaultValue={initial.description}
          rows={6}
          maxLength={10_000}
          aria-invalid={Boolean(errors.description) || undefined}
        />
      </FormField>

      <div className="flex justify-end border-t border-border/70 pt-4">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          Save changes
        </Button>
      </div>
    </form>
  );
}
