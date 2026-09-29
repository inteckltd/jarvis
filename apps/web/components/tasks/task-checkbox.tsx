"use client";

import { Check, Loader2 } from "lucide-react";
import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { setTaskCompletedAction } from "@/lib/actions/tasks";
import { cn } from "@/lib/utils";

export function TaskCheckbox({
  taskId,
  title,
  completed,
  size = "md",
}: {
  taskId: string;
  title: string;
  completed: boolean;
  size?: "md" | "lg";
}) {
  const [pending, startTransition] = useTransition();
  const [checked, setChecked] = useOptimistic(completed);

  const toggle = () => {
    const next = !checked;
    startTransition(async () => {
      setChecked(next);
      const result = await setTaskCompletedAction(taskId, next);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      if (next) {
        toast.success(`Completed "${title}"`, {
          action: {
            label: "Undo",
            onClick: () => void setTaskCompletedAction(taskId, false),
          },
        });
      }
    });
  };

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={checked ? `Mark "${title}" as not done` : `Mark "${title}" as done`}
      onClick={toggle}
      disabled={pending}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full border transition-[color,background-color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40",
        size === "lg" ? "size-6" : "size-5",
        checked
          ? "border-status-healthy/60 bg-status-healthy/15 text-status-healthy"
          : "border-primary/50 text-transparent hover:border-primary hover:text-primary/60 hover:shadow-[0_0_10px_-2px_var(--glow)]",
      )}
    >
      {pending ? (
        <Loader2 className="size-3 animate-spin text-primary" />
      ) : (
        <Check className={size === "lg" ? "size-3.5" : "size-3"} />
      )}
    </button>
  );
}
