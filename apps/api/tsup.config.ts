import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node22",
  platform: "node",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  // Workspace packages ship TypeScript source, so bundle them; keep Prisma external.
  noExternal: [/^@jarvis\//],
  external: ["@prisma/client", ".prisma/client"],
});
