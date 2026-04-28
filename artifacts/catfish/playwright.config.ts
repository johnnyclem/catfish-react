import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for the Catfish parody mini-game e2e suite.
 *
 * The dev workflow (`pnpm --filter @workspace/catfish run dev`) serves the
 * Expo web build on http://localhost:${PORT}. Tests assume that workflow is
 * already running — they do NOT spawn it themselves because the Expo dev
 * server is heavy to boot and the version-check shim runs as a side-effect
 * of `pnpm dev` (see `scripts/dev.mjs`).
 *
 * To run locally:
 *   pnpm --filter @workspace/catfish dev          # in one shell
 *   pnpm --filter @workspace/catfish test:e2e:install   # one-time browser dl
 *   pnpm --filter @workspace/catfish test:e2e
 *
 * Tests share state across scenarios (each scenario verifies persistence
 * of the previous one's writes), so we run a single worker. Retries are
 * disabled so that a flaky pass doesn't paper over a real regression.
 */

const PORT = process.env.PORT ?? "8000";
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./__tests__/e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    headless: true,
    viewport: { width: 400, height: 720 },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
