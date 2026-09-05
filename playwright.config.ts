import { defineConfig, devices } from "@playwright/test";

const e2eOrigin = "http://127.0.0.1:32081";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "html",
  use: {
    baseURL: e2eOrigin,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "mobile-safari",
      use: { ...devices["iPhone 13"] },
    },
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "android-chromium-responsive",
      testMatch: /(admin-pin-entry|motion|staff-layout)\.spec\.ts/,
      use: { ...devices["Pixel 7"] },
    },
    {
      name: "tablet-webkit-responsive",
      testMatch: /(admin-pin-entry|motion|staff-layout)\.spec\.ts/,
      use: { ...devices["iPad Pro 11"] },
    },
  ],
  webServer: {
    command: "npm run dev -- --port 32081",
    url: e2eOrigin,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
