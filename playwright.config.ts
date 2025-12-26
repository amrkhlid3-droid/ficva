import { defineConfig, devices } from "@playwright/test"
import dotenv from "dotenv"

dotenv.config({ path: ".env.production.local" })

const PORT = 3001
const baseURL = `http://localhost:${PORT}`

export default defineConfig({
  expect: {
    timeout: 20000, // Increase match timeout to 20s for high concurrency / 高并发下增加匹配超时时间到20秒
  },
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1, // Retry once locally to handle concurrency flakes / 本地重试一次以处理并发不稳定性
  workers: process.env.CI ? 1 : "80%", // Use 80% CPU locally / 本地使用 80% CPU
  reporter: "html",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
  ],
  webServer: {
    command: "npm run start -- -p 3001",
    url: baseURL,
    reuseExistingServer: true,
  },
})
