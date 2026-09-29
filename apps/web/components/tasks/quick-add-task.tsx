"use client";

import { Loader2, Plus } from "lucide-react";
import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { createTaskAction, type TaskFormState } from "@/lib/actions/tasks";
import { cn } from "@/lib/utils";

export type TaskClientOption = { id: string; name: string };

type Props = {
  clients: TaskClientOption[];
  /** "YYYY-MM-DD" for today in London; passed in so server and browser agree. */
  today: string;
  /** Pre-selected client; "" = internal. */
  defaultClientId?: string;
  /** Hide the client picker (e.g. on a client's page). */
  fixedClient?: boolean;
  className?: string;
};

const initialState: TaskFormState = { status: "idle" };

export function QuickAddTask({
  clients,
  today,
  defaultClientId = "",
  fixedClient = false,
  className,
}: Props) {
  const [state, formAction, pending] = useActionState(createTaskAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const errors = state.status === "error" ? state.fieldErrors : {};

  const savedAt = state.status === "saved" ? state.at : null;
  useEffect(() => {
    if (savedAt === null || state.status !== "saved") return;
    toast.success(`Added "${state.title}"`);
    // Keep client and due date for the next task; clear the title only.
    if (titleRef.current) titleRef.current.value = "";
    titleRef.current?.focus();
  }, [savedAt, state]);

  useEffect(() => {
    if (state.status === "error" && state.message) toast.error(state.message);
  }, [state]);

  const error = errors.title ?? errors.dueDate ?? errors.clientId;

  return (
    <form
      ref={formRef}
      action={formAction}
      className={cn("flex flex-col gap-2", className)}
      noValidate
    >
      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <Input
          ref={titleRef}
          name="title"
          placeholder="Add a task… e.g. Renew SSL certificate"
          aria-label="Task title"
          aria-invalid={Boolean(errors.title) || undefined}
          autoComplete="off"
          maxLength={200}
          className="md:flex-1"
        />
        <input type="hidden" name="description" value="" />
        {fixedClient ? (
          <input type="hidden" name="clientId" value={defaultClientId} />
        ) : (
          <NativeSelect
            name="clientId"
            defaultValue={defaultClientId}
            aria-label="Client"
            aria-invalid={Boolean(errors.clientId) || undefined}
            className="md:w-48"
          >
            <option value="">Internal (Inteck)</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </NativeSelect>
        )}
        <Input
          type="date"
          name="dueDate"
          defaultValue={today}
          aria-label="Due date"
          aria-invalid={Boolean(errors.dueDate) || undefined}
          className="font-mono [color-scheme:dark] md:w-40"
          required
        />
        <Button type="submit" disabled={pending} className="md:w-auto">
          {pending ? <Loader2 className="animate-spin" /> : <Plus />}
          Add
        </Button>
      </div>
      {error && <p className="text-xs text-status-critical">{error}</p>}
    </form>
  );
}
