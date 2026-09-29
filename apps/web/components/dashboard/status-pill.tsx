import { HEALTH_STATUS_LABEL, type HealthStatus } from "@jarvis/shared";
import { StatusDot } from "@/components/hud/status-dot";
import { Badge } from "@/components/ui/badge";

export function StatusPill({
  status,
  label,
  className,
}: {
  status: HealthStatus;
  label?: string;
  className?: string;
}) {
  return (
    <Badge variant={status} className={className}>
      <StatusDot status={status} className="size-1.5 [&>span]:size-1.5" />
      {label ?? HEALTH_STATUS_LABEL[status]}
    </Badge>
  );
}
