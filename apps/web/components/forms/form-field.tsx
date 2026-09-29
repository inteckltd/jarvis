import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function FormField({
  id,
  label,
  error,
  hint,
  className,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: ReactNode;
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

export function FormAlert({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return (
    <p
      className="rounded-md border border-status-critical/40 bg-status-critical/10 px-3 py-2 text-sm text-status-critical"
      role="alert"
    >
      {message}
    </p>
  );
}
