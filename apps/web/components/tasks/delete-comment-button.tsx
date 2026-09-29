"use client";

import { Loader2, Trash2 } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteCommentAction } from "@/lib/actions/tasks";

export function DeleteCommentButton({ commentId }: { commentId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-7 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-status-critical focus-visible:opacity-100"
      aria-label="Delete comment"
      disabled={pending}
      onClick={() => {
        if (!window.confirm("Delete this comment?")) return;
        startTransition(async () => {
          const result = await deleteCommentAction(commentId);
          if (result?.error) toast.error(result.error);
        });
      }}
    >
      {pending ? <Loader2 className="animate-spin" /> : <Trash2 />}
    </Button>
  );
}
