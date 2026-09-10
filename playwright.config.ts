import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  timeout: 30000,
  use: {
    baseURL: "http://127.0.0.1:1430",
    channel: "msedge",
    viewport: { width: 1280, height: 820 },
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:1430",
    reuseExistingServer: !process.env.CI,
  },
  workers: 1,
});
