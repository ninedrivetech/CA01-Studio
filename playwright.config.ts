import { defineConfig } from "@playwright/test";
const port = Number(process.env.CICADA_TEST_PORT || (process.platform === "win32" ? 1431 : 1432));
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("Invalid CICADA_TEST_PORT");
const baseURL = `http://127.0.0.1:${port}`;
export default defineConfig({
  testDir: "./tests",
  timeout: 30000,
  use: {
    baseURL,
    channel: process.platform === "win32" ? "msedge" : undefined,
    viewport: { width: 1280, height: 820 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: `node node_modules/vite/bin/vite.js --host 127.0.0.1 --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: false,
  },
  workers: 1,
});
