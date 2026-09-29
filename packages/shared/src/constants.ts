export const TIMEZONE = "Europe/London";

export const DEFAULT_THRESHOLDS = {
  warning: 75,
  critical: 90,
} as const;

export type Thresholds = { warning: number; critical: number };

export const RESTART_THRESHOLDS = {
  /** Any restart on a PRODUCTION component in the window turns it amber. */
  warning: 1,
  /** This many restarts in the window turns it red. */
  critical: 3,
  windowHours: 24,
} as const;

export const RETENTION = {
  rawDays: 90,
  rollupMonths: 13,
} as const;
