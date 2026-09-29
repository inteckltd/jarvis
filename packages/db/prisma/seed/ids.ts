import { type Environment, type Provider, type ResourceType } from "@prisma/client";

/**
 * Pilot client definition. IDS exists only as seed data; nothing in the
 * application code refers to it. External IDs are obviously fake ("mock-")
 * so live imports later can't collide with them.
 */

export const IDS_CLIENT = {
  name: "Industrial Door Systems",
  slug: "ids",
  contactName: "IDS Operations",
  contactEmail: "operations@ids.example.com",
  notes:
    "Pilot client. Simplx platform: workforce API, HTML-to-PDF API, Supabase database and edge functions, web UI on Vercel, Expo mobile app.",
} as const;

export type AccountKey = "digitalocean" | "supabase" | "vercel" | "expo";

export const PROVIDER_ACCOUNTS: Record<
  AccountKey,
  { label: string; provider: Provider; envVarName: string }
> = {
  digitalocean: {
    label: "Inteck DigitalOcean",
    provider: "DIGITALOCEAN",
    envVarName: "DO_API_TOKEN",
  },
  supabase: { label: "Inteck Supabase", provider: "SUPABASE", envVarName: "SUPABASE_ACCESS_TOKEN" },
  vercel: { label: "Inteck Vercel", provider: "VERCEL", envVarName: "VERCEL_TOKEN" },
  expo: { label: "Inteck Expo", provider: "EXPO", envVarName: "EXPO_TOKEN" },
};

export const GITHUB_ORG = "industrial-door-systems";

export type RepoKey = "workforceApi" | "htmlPdf" | "serverless" | "ui" | "mobile";

export const REPOSITORIES: Record<
  RepoKey,
  { name: string; productionBranch: string; developmentBranch: string | null }
> = {
  workforceApi: {
    name: "ids.workforce-api",
    productionBranch: "main",
    developmentBranch: "pre-production",
  },
  htmlPdf: {
    name: "ids.simplx-html-pdf-converter",
    productionBranch: "main",
    developmentBranch: "pre-production",
  },
  serverless: {
    name: "ids.simplx-serverless",
    productionBranch: "main",
    developmentBranch: "pre-production",
  },
  ui: { name: "ids-simplx.ui", productionBranch: "main", developmentBranch: "pre-production" },
  // Mobile releases are manual, not branch-based.
  mobile: { name: "ids-simplx.mobile", productionBranch: "main", developmentBranch: null },
};

export type ResourceKey =
  | "workforceProd"
  | "workforceDev"
  | "htmlPdfProd"
  | "htmlPdfDev"
  | "dbProd"
  | "dbDev"
  | "functionsProd"
  | "functionsDev"
  | "uiProd"
  | "uiDev"
  | "mobile";

export type ResourceDef = {
  name: string;
  environment: Environment;
  type: ResourceType;
  account: AccountKey;
  externalId: string;
  region: string | null;
  liveUrl: string | null;
  healthCheckUrl: string | null;
  repo: RepoKey | null;
  config: Record<string, string>;
};

const SUPABASE_PROD_REF = "mockidsprodref0001";
const SUPABASE_DEV_REF = "mockidsdevref00001";
const VERCEL_PROJECT_ID = "prj_mock_ids_simplx_ui";

export const RESOURCES: Record<ResourceKey, ResourceDef> = {
  workforceProd: {
    name: "workforce-api",
    environment: "PRODUCTION",
    type: "DO_APP",
    account: "digitalocean",
    externalId: "mock-do-app-workforce-api-prod",
    region: "lon",
    liveUrl: "https://ids-workforce-api-mock.ondigitalocean.app",
    healthCheckUrl: "https://ids-workforce-api-mock.ondigitalocean.app/health",
    repo: "workforceApi",
    config: { componentName: "workforce-api" },
  },
  workforceDev: {
    name: "workforce-api",
    environment: "DEVELOPMENT",
    type: "DO_APP",
    account: "digitalocean",
    externalId: "mock-do-app-workforce-api-dev",
    region: "lon",
    liveUrl: "https://ids-workforce-api-dev-mock.ondigitalocean.app",
    healthCheckUrl: "https://ids-workforce-api-dev-mock.ondigitalocean.app/health",
    repo: "workforceApi",
    config: { componentName: "workforce-api" },
  },
  htmlPdfProd: {
    name: "html-pdf-api",
    environment: "PRODUCTION",
    type: "DO_APP",
    account: "digitalocean",
    externalId: "mock-do-app-html-pdf-api-prod",
    region: "lon",
    liveUrl: "https://ids-html-pdf-api-mock.ondigitalocean.app",
    healthCheckUrl: "https://ids-html-pdf-api-mock.ondigitalocean.app/health",
    repo: "htmlPdf",
    config: { componentName: "html-pdf-api" },
  },
  htmlPdfDev: {
    name: "html-pdf-api",
    environment: "DEVELOPMENT",
    type: "DO_APP",
    account: "digitalocean",
    externalId: "mock-do-app-html-pdf-api-dev",
    region: "lon",
    liveUrl: "https://ids-html-pdf-api-dev-mock.ondigitalocean.app",
    healthCheckUrl: "https://ids-html-pdf-api-dev-mock.ondigitalocean.app/health",
    repo: "htmlPdf",
    config: { componentName: "html-pdf-api" },
  },
  dbProd: {
    name: "Database",
    environment: "PRODUCTION",
    type: "SUPABASE_PROJECT",
    account: "supabase",
    externalId: SUPABASE_PROD_REF,
    region: "eu-west-2",
    liveUrl: `https://${SUPABASE_PROD_REF}.supabase.co`,
    healthCheckUrl: null,
    repo: null,
    config: { plan: "pro" },
  },
  dbDev: {
    name: "Database",
    environment: "DEVELOPMENT",
    type: "SUPABASE_PROJECT",
    account: "supabase",
    externalId: SUPABASE_DEV_REF,
    region: "eu-west-2",
    liveUrl: `https://${SUPABASE_DEV_REF}.supabase.co`,
    healthCheckUrl: null,
    repo: null,
    config: { plan: "free" },
  },
  functionsProd: {
    name: "Edge functions",
    environment: "PRODUCTION",
    type: "SUPABASE_FUNCTIONS",
    account: "supabase",
    externalId: SUPABASE_PROD_REF,
    region: "eu-west-2",
    liveUrl: `https://${SUPABASE_PROD_REF}.supabase.co/functions/v1`,
    healthCheckUrl: null,
    repo: "serverless",
    config: {},
  },
  functionsDev: {
    name: "Edge functions",
    environment: "DEVELOPMENT",
    type: "SUPABASE_FUNCTIONS",
    account: "supabase",
    externalId: SUPABASE_DEV_REF,
    region: "eu-west-2",
    liveUrl: `https://${SUPABASE_DEV_REF}.supabase.co/functions/v1`,
    healthCheckUrl: null,
    repo: "serverless",
    config: {},
  },
  uiProd: {
    name: "Web UI",
    environment: "PRODUCTION",
    type: "VERCEL_PROJECT",
    account: "vercel",
    externalId: VERCEL_PROJECT_ID,
    region: "lhr1",
    liveUrl: "https://ids-simplx-ui-mock.vercel.app",
    healthCheckUrl: "https://ids-simplx-ui-mock.vercel.app",
    repo: "ui",
    config: { target: "production", branch: "main" },
  },
  uiDev: {
    name: "Web UI",
    environment: "DEVELOPMENT",
    type: "VERCEL_PROJECT",
    account: "vercel",
    externalId: VERCEL_PROJECT_ID,
    region: "lhr1",
    liveUrl: "https://ids-simplx-ui-git-pre-production-inteck-mock.vercel.app",
    healthCheckUrl: "https://ids-simplx-ui-git-pre-production-inteck-mock.vercel.app",
    repo: "ui",
    config: { target: "preview", branch: "pre-production" },
  },
  mobile: {
    name: "Mobile app",
    environment: "NONE",
    type: "EXPO_APP",
    account: "expo",
    externalId: "mock-expo-project-ids-simplx",
    region: null,
    liveUrl: null,
    healthCheckUrl: null,
    repo: "mobile",
    config: {
      bundleId: "com.example.ids.simplx",
      iosAppId: "0000000000",
      androidPackage: "com.example.ids.simplx",
    },
  },
};

export const COMMIT_MESSAGES: Record<RepoKey, readonly string[]> = {
  workforceApi: [
    "Add pagination to /jobs endpoint",
    "Fix timezone handling on shift export",
    "Cache engineer availability lookups",
    "Validate door survey payloads with zod",
    "Bump node to 22 in Dockerfile",
    "Add index on jobs.scheduled_for",
    "Return 404 for archived sites",
    "Refactor auth middleware",
    "Improve error logging for Simplx sync",
    "Add /health endpoint",
  ],
  htmlPdf: [
    "Reuse browser instance between renders",
    "Increase render timeout for large quotes",
    "Fix page-break inside tables",
    "Add A5 paper size option",
    "Close pages on render error to free memory",
    "Upgrade puppeteer",
  ],
  serverless: [
    "generate-pdf: pass locale to renderer",
    "send-notification: retry on 429",
    "sync-workforce: batch upserts",
    "process-webhook: verify signature",
    "Shared: move CORS helper",
  ],
  ui: [
    "Jobs table: sticky header",
    "Fix date picker in Safari",
    "Add site notes drawer",
    "Dashboard: lazy-load charts",
    "Improve empty states",
    "Quote builder: keyboard shortcuts",
    "Upgrade Next.js",
    "Fix hydration warning on login",
  ],
  mobile: [
    "Offline queue for job photos",
    "Fix signature pad on Android",
    "Bump Expo SDK",
    "Add push notification deep links",
    "Release 2.4.0",
  ],
};

export const EDGE_FUNCTIONS = [
  "generate-pdf",
  "send-notification",
  "sync-workforce",
  "process-webhook",
] as const;
