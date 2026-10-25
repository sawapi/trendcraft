import { defineConfig, devices } from "@playwright/test";

/**
 * Browser tests for @trendcraft/chart. The unit suite runs in happy-dom,
 * which has no canvas rasterizer and no real input pipeline; these specs
 * cover what only a browser can: painted pixels, wheel / drag / touch
 * gestures and their timing. See e2e/README.md for the test perspectives.
 *
 * Locally the installed Google Chrome is used (no browser download); in CI
 * Playwright's own Chromium (`playwright install --with-deps chromium`).
 */
export default defineConfig({
  testDir: "./e2e/specs",
  testMatch: "**/*.e2e.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: "http://localhost:5310",
    viewport: { width: 1000, height: 700 },
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], channel: process.env.CI ? undefined : "chrome" },
    },
  ],
  webServer: {
    command: "node ./node_modules/vite/bin/vite.js --config e2e/vite.config.ts",
    url: "http://localhost:5310",
    // Never reuse: another worktree's server on the same port would serve
    // different chart source and the run would pass against the wrong code.
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
