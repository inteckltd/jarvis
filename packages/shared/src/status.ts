/** Display status. "nodata" = no data / connection error (grey). N/A metrics are not a status. */
export type HealthStatus = "healthy" | "warning" | "critical" | "nodata";

export const HEALTH_STATUS_LABEL: Record<HealthStatus, string> = {
  healthy: "Healthy",
  warning: "Warning",
  critical: "Critical",
  nodata: "No data",
};
