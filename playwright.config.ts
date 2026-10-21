import { defineConfig, devices } from "@playwright/test";

const PORT = 3123;

/**
 * End-to-end acceptance flow. Runs a production build against a brand-new,
 * empty data folder (.e2e-data) so it never touches your real library.
 */
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    viewport: { width: 1500, height: 950 },
    locale: "es-ES",
    acceptDownloads: true,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1500, height: 950 } } }],
  webServer: {
    command: `rm -rf .e2e-data && npm run build && npx next start -H 127.0.0.1 -p ${PORT}`,
    url: `http://127.0.0.1:${PORT}/santos`,
    timeout: 300_000,
    reuseExistingServer: false,
    env: { SANTOS_DATA_DIR: ".e2e-data" },
  },
});
