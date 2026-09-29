import { DEFAULT_THRESHOLDS, RESTART_THRESHOLDS, type Thresholds } from "./constants";
import type { EnvironmentName, ResourceTypeName } from "./providers";
import type { HealthStatus } from "./status";
import { MINUTE_MS } from "./time";

/** Older than this and the latest sample no longer describes "now". */
export const FRESHNESS = {
  /** Metrics are collected every 5 minutes. */
  metricsMs: 20 * MINUTE_MS,
  /** Health checks run every minute. */
  healthMs: 5 * MINUTE_MS,
} as const;

/** Resource types that report CPU / memory. */
export const METRIC_TYPES: readonly ResourceTypeName[] = [
  "DO_APP",
  "DO_DROPLET",
  "SUPABASE_PROJECT",
  "AWS_EC2",
];

/** Resource types where disk is not applicable (show "N/A", never an error). */
export const DISK_NOT_APPLICABLE: readonly ResourceTypeName[] = ["DO_APP"];

/** Resource types whose restarts count towards status. */
export const RESTART_TYPES: readonly ResourceTypeName[] = ["DO_APP", "DO_DROPLET", "AWS_EC2"];

/** Resource types whose latest deployment counts towards status. */
export const DEPLOY_TYPES: readonly ResourceTypeName[] = ["DO_APP", "VERCEL_PROJECT"];

const RANK: Record<HealthStatus, number> = { nodata: 0, healthy: 1, warning: 2, critical: 3 };

/**
 * Worst of the given statuses. "nodata" only wins when nothing else reported:
 * a missing signal is surfaced as a note, it never masks a real reading.
 */
export function worstStatus(statuses: readonly HealthStatus[]): HealthStatus {
  let worst: HealthStatus = "nodata";
  for (const s of statuses) if (RANK[s] > RANK[worst]) worst = s;
  return worst;
}

export function percentStatus(
  value: number | null,
  thresholds: Thresholds = DEFAULT_THRESHOLDS,
): HealthStatus {
  if (value === null || Number.isNaN(value)) return "nodata";
  if (value >= thresholds.critical) return "critical";
  if (value >= thresholds.warning) return "warning";
  return "healthy";
}

export function restartStatus(restarts: number | null): HealthStatus {
  if (restarts === null) return "nodata";
  if (restarts >= RESTART_THRESHOLDS.critical) return "critical";
  if (restarts >= RESTART_THRESHOLDS.warning) return "warning";
  return "healthy";
}

/** Uptime as a percentage (2 dp), or null when there are no checks. */
export function uptimePercent(up: number, total: number): number | null {
  if (total <= 0) return null;
  return Math.floor((up / total) * 10_000) / 100;
}

export type Reason = { status: HealthStatus; message: string };

export type ResourceSignals = {
  type: ResourceTypeName;
  environment: EnvironmentName;
  metrics: {
    cpuPercent: number | null;
    memoryPercent: number | null;
    diskPercent: number | null;
    capturedAt: Date;
  } | null;
  /** Sum over the last RESTART_THRESHOLDS.windowHours; null = no samples. */
  restarts: number | null;
  latestDeployment: { status: "BUILDING" | "SUCCESS" | "FAILED" | "CANCELED" } | null;
  hasHealthCheck: boolean;
  latestHealth: { isUp: boolean; statusCode: number | null; checkedAt: Date } | null;
  /** Edge function stats for the last 24h (SUPABASE_FUNCTIONS only); null = none. */
  functions?: { invocations: number; errors: number } | null;
  lastError: string | null;
  now: Date;
  thresholds?: Thresholds;
};

export type ResourceEvaluation = {
  status: HealthStatus;
  cpu: HealthStatus;
  memory: HealthStatus;
  /** null = not applicable. */
  disk: HealthStatus | null;
  restarts: HealthStatus | null;
  deployment: HealthStatus | null;
  health: HealthStatus | null;
  metricsFresh: boolean;
  reasons: Reason[];
};

function ageText(ms: number): string {
  const minutes = Math.round(ms / MINUTE_MS);
  if (minutes < 90) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.round(hours / 24)} days`;
}

/** RAG status for one resource plus human-readable reasons, worst first. */
export function evaluateResource(s: ResourceSignals): ResourceEvaluation {
  const thresholds = s.thresholds ?? DEFAULT_THRESHOLDS;
  const reasons: Reason[] = [];
  const signals: HealthStatus[] = [];

  const expectsMetrics = METRIC_TYPES.includes(s.type);
  const metricsAge = s.metrics ? s.now.getTime() - s.metrics.capturedAt.getTime() : null;
  const metricsFresh = metricsAge !== null && metricsAge <= FRESHNESS.metricsMs;
  const current = metricsFresh ? s.metrics : null;

  let cpu: HealthStatus = "nodata";
  let memory: HealthStatus = "nodata";
  let disk: HealthStatus | null = DISK_NOT_APPLICABLE.includes(s.type) ? null : "nodata";

  if (expectsMetrics) {
    if (!current) {
      reasons.push({
        status: "nodata",
        message: metricsAge === null ? "No metrics yet" : `No metrics for ${ageText(metricsAge)}`,
      });
    } else {
      cpu = percentStatus(current.cpuPercent, thresholds);
      memory = percentStatus(current.memoryPercent, thresholds);
      if (disk !== null) disk = percentStatus(current.diskPercent, thresholds);
      const check = (label: string, status: HealthStatus | null, value: number | null) => {
        if (status === null || status === "nodata") return;
        signals.push(status);
        if (status !== "healthy" && value !== null) {
          reasons.push({ status, message: `${label} at ${Math.round(value)}%` });
        }
      };
      check("CPU", cpu, current.cpuPercent);
      check("Memory", memory, current.memoryPercent);
      check("Disk", disk, current.diskPercent);
    }
  } else {
    disk = null;
  }

  let restarts: HealthStatus | null = null;
  if (RESTART_TYPES.includes(s.type)) {
    restarts = restartStatus(s.restarts);
    if (restarts !== "nodata") signals.push(restarts);
    if ((restarts === "warning" || restarts === "critical") && s.restarts !== null) {
      reasons.push({
        status: restarts,
        message: `${s.restarts} restart${s.restarts === 1 ? "" : "s"} in ${RESTART_THRESHOLDS.windowHours}h`,
      });
    }
  }

  let deployment: HealthStatus | null = null;
  if (DEPLOY_TYPES.includes(s.type)) {
    if (!s.latestDeployment) {
      deployment = "nodata";
    } else if (s.latestDeployment.status === "FAILED") {
      deployment = "critical";
      reasons.push({ status: "critical", message: "Latest deployment failed" });
    } else {
      deployment = "healthy";
    }
    if (deployment !== "nodata") signals.push(deployment);
  }

  let health: HealthStatus | null = null;
  if (s.hasHealthCheck) {
    const age = s.latestHealth ? s.now.getTime() - s.latestHealth.checkedAt.getTime() : null;
    if (!s.latestHealth || age === null || age > FRESHNESS.healthMs) {
      health = "nodata";
      reasons.push({
        status: "nodata",
        message: age === null ? "No health checks yet" : `No health check for ${ageText(age)}`,
      });
    } else if (!s.latestHealth.isUp) {
      health = "critical";
      reasons.push({
        status: "critical",
        message: s.latestHealth.statusCode
          ? `Health check down (HTTP ${s.latestHealth.statusCode})`
          : "Health check down (no response)",
      });
      signals.push(health);
    } else {
      health = "healthy";
      signals.push(health);
    }
  }

  if (s.type === "SUPABASE_FUNCTIONS") {
    // Usage is informational: no thresholds are defined for error rates.
    if (s.functions) signals.push("healthy");
    else reasons.push({ status: "nodata", message: "No function stats in 24h" });
  }

  if (s.lastError) reasons.push({ status: "nodata", message: s.lastError });

  reasons.sort((a, b) => RANK[b.status] - RANK[a.status]);
  return {
    status: worstStatus(signals),
    cpu,
    memory,
    disk,
    restarts,
    deployment,
    health,
    metricsFresh,
    reasons,
  };
}

/** Client RAG: PRODUCTION only. Development never changes it. */
export function clientStatus(
  resources: readonly { environment: EnvironmentName; status: HealthStatus }[],
): HealthStatus {
  return worstStatus(resources.filter((r) => r.environment === "PRODUCTION").map((r) => r.status));
}
