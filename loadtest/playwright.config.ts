import { defineConfig, devices } from "@playwright/test";
import { enforceLoadtestSafety } from "./safety-guard.mjs";

const { appBaseUrl } = enforceLoadtestSafety();

export default defineConfig({
  testDir: "./playwright",
  timeout: 180_000,
  expect: {
    timeout: 15_000,
  },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: appBaseUrl,
    trace: "off",
    video: "off",
    screenshot: "off",
  },
  projects: [
    {
      name: "chromium-desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
});
