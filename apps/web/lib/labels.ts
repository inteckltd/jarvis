import type {
  DeploymentStatus,
  Environment,
  MobileBuildStatus,
  Provider,
  ResourceType,
} from "@jarvis/db";
import type { HealthStatus } from "@jarvis/shared";

export const DEPLOYMENT_STATUS: Record<
  DeploymentStatus,
  { label: string; variant: HealthStatus | "default" }
> = {
  BUILDING: { label: "Building", variant: "default" },
  SUCCESS: { label: "Live", variant: "healthy" },
  FAILED: { label: "Failed", variant: "critical" },
  CANCELED: { label: "Cancelled", variant: "nodata" },
};

export const BUILD_STATUS: Record<
  MobileBuildStatus,
  { label: string; variant: HealthStatus | "default" }
> = {
  QUEUED: { label: "Queued", variant: "default" },
  IN_PROGRESS: { label: "Building", variant: "default" },
  FINISHED: { label: "Finished", variant: "healthy" },
  ERRORED: { label: "Errored", variant: "critical" },
  CANCELED: { label: "Cancelled", variant: "nodata" },
};

export const SHORT_TYPE_LABEL: Record<ResourceType, string> = {
  DO_APP: "App Platform",
  DO_DROPLET: "Droplet",
  SUPABASE_PROJECT: "Supabase DB",
  SUPABASE_FUNCTIONS: "Edge functions",
  VERCEL_PROJECT: "Vercel",
  EXPO_APP: "Expo",
  AWS_EC2: "EC2",
};

export const RESOURCE_TYPE_LABEL: Record<ResourceType, string> = {
  DO_APP: "DO App Platform",
  DO_DROPLET: "DO Droplet",
  SUPABASE_PROJECT: "Supabase database",
  SUPABASE_FUNCTIONS: "Supabase edge functions",
  VERCEL_PROJECT: "Vercel",
  EXPO_APP: "Expo / EAS",
  AWS_EC2: "AWS EC2",
};

export const PROVIDER_LABEL: Record<Provider, string> = {
  DIGITALOCEAN: "DigitalOcean",
  AWS: "AWS",
  SUPABASE: "Supabase",
  VERCEL: "Vercel",
  EXPO: "Expo",
};

export const ENVIRONMENT_LABEL: Record<Environment, string> = {
  PRODUCTION: "Production",
  DEVELOPMENT: "Development",
  NONE: "No environment",
};
