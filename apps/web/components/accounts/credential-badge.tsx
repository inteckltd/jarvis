import { type CredentialStatusList } from "@jarvis/shared";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type Status = CredentialStatusList["accounts"][number] | undefined;

/** Credential availability as reported by apps/api. `undefined` means the API couldn't be asked. */
export function CredentialBadge({ status }: { status: Status | null }) {
  if (status === null) return <Badge variant="nodata">API offline</Badge>;
  if (!status) return <Badge variant="nodata">Unknown</Badge>;
  if (status.status === "ok") {
    return <Badge variant="outline">Token {status.masked}</Badge>;
  }
  const label =
    status.status === "missing"
      ? "Token missing"
      : status.status === "unreadable"
        ? "Token unreadable"
        : "Unsupported";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="warning" tabIndex={0}>
          {label}
        </Badge>
      </TooltipTrigger>
      {status.detail && <TooltipContent className="max-w-sm">{status.detail}</TooltipContent>}
    </Tooltip>
  );
}
