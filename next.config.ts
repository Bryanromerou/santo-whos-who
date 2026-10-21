import path from "node:path";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// Santos Studio is a local-first app: every page reads live data from SQLite,
// so Cache Components (static shells + preserved route state) is disabled and
// pages opt into dynamic rendering explicitly.
const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3", "sharp", "playwright", "playwright-core"],
  // Never trace the mutable data/ folder into build output.
  outputFileTracingRoot: path.resolve(__dirname),
  outputFileTracingExcludes: { "*": ["data/**", ".e2e-data/**", "seed/**"] },
  turbopack: {
    root: path.resolve(__dirname),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

// Interface language (es/en) without locale routing; see src/i18n/request.ts.
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
