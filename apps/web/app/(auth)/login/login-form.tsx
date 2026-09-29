"use client";

import { Loader2, MailCheck } from "lucide-react";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type LoginState, sendMagicLink } from "./actions";

const initialState: LoginState = { status: "idle" };

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(sendMagicLink, initialState);

  if (state.status === "sent") {
    return (
      <div className="flex flex-col items-center gap-3 py-4 text-center" role="status">
        <MailCheck className="size-8 text-primary drop-shadow-[0_0_8px_var(--glow)]" />
        <p className="font-medium">Check your inbox</p>
        <p className="text-sm text-muted-foreground">
          If <span className="font-mono text-foreground">{state.email}</span> is authorised, a
          sign-in link is on its way.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {next && <input type="hidden" name="next" value={next} />}
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          autoFocus
          placeholder="you@inteck.co.uk"
          aria-invalid={state.status === "error" || undefined}
        />
      </div>
      {state.status === "error" && (
        <p className="text-sm text-status-critical" role="alert">
          {state.message}
        </p>
      )}
      <Button type="submit" disabled={pending} className="w-full">
        {pending && <Loader2 className="animate-spin" />}
        Send magic link
      </Button>
    </form>
  );
}
