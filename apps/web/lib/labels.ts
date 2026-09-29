import type { Environment, Provider, ResourceType } from "@jarvis/db";

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
