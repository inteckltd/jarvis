"use client";

import { Loader2, Send } from "lucide-react";
import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { CommentFormState } from "@/lib/actions/tasks";

const initialState: CommentFormState = { status: "idle" };

export function CommentForm({
  action,
}: {
  action: (prev: CommentFormState, formData: FormData) => Promise<CommentFormState>;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const error = state.status === "error" ? (state.fieldErrors.body ?? state.message) : null;

  useEffect(() => {
    if (state.status === "saved") formRef.current?.reset();
    if (state.status === "error" && state.message) toast.error(state.message);
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-2" noValidate>
      <Textarea
        name="body"
        rows={3}
        maxLength={5_000}
        placeholder="Write a comment…"
        aria-label="Comment"
        aria-invalid={Boolean(error) || undefined}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            formRef.current?.requestSubmit();
          }
        }}
      />
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {error ? <span className="text-status-critical">{error}</span> : "⌘ + Enter to post"}
        </p>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <Send />}
          Comment
        </Button>
      </div>
    </form>
  );
}
