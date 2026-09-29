"use client";

import { Loader2, PlugZap } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { testConnectionAction } from "@/app/(app)/settings/accounts/actions";
import { Button } from "@/components/ui/button";

export function TestConnectionButton({ accountId }: { accountId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await testConnectionAction(accountId);
          if (result.ok) toast.success(result.message);
          else toast.error(result.message);
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <PlugZap />}
      Test connection
    </Button>
  );
}
