"use client";

import { Loader2, Trash2 } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/** Asks for confirmation, then runs a Server Action that redirects on success or returns an error. */
export function ConfirmDeleteButton({
  action,
  confirmText,
  label = "Delete",
}: {
  action: () => Promise<{ error: string } | undefined>;
  confirmText: string;
  label?: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="destructive"
      disabled={pending}
      onClick={() => {
        if (!window.confirm(confirmText)) return;
        startTransition(async () => {
          const result = await action();
          if (result?.error) toast.error(result.error);
        });
      }}
    >
      {pending ? <Loader2 className="animate-spin" /> : <Trash2 />}
      {label}
    </Button>
  );
}
