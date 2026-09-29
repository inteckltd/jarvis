import type { NextConfig } from "next";

// Env comes from the monorepo root .env, loaded by dotenv-cli in the package scripts
// (so the middleware and every worker see it). Platform env vars take precedence.
const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ["@jarvis/shared", "@jarvis/db"],
  serverExternalPackages: ["@prisma/client", ".prisma/client"],
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
