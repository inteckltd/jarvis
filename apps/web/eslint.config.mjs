import nextPlugin from "@next/eslint-plugin-next";
import { baseConfig } from "../../eslint.config.mjs";

export default [
  ...baseConfig,
  {
    ...nextPlugin.flatConfig.coreWebVitals,
    settings: { next: { rootDir: import.meta.dirname } },
  },
];
