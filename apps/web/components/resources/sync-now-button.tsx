"use client";

import { Loader2, RefreshCw } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { syncResourceAction } from "@/lib/actions/resources";

export function SyncNowButton({
  resourceId,
  variant = "ghost",
}: {
  resourceId: string;
  variant?: "ghost" | "outline";
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant={variant}
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await syncResourceAction(resourceId);
          if (result.ok) toast.success(result.message);
          else toast.error(result.message);
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <RefreshCw />}
      {pending ? "Syncing…" : "Sync now"}
    </Button>
  );
}
