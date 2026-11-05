import { chromium, defineConfig } from '@playwright/test'
import { existsSync } from 'node:fs'

// Prefer Playwright's bundled browser; reuse system Chromium when downloads are unavailable.
const executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH ??
  (!existsSync(chromium.executablePath()) && existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined)

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:5173', trace: 'retain-on-failure', screenshot: 'only-on-failure', launchOptions: { executablePath } },
  projects: [
    { name: 'mobile', use: { browserName: 'chromium', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    { name: 'desktop', use: { browserName: 'chromium', viewport: { width: 1440, height: 1000 } } },
  ],
  webServer: { command: 'npm run dev -- --host 127.0.0.1 --port 5173 --strictPort', url: 'http://127.0.0.1:5173', reuseExistingServer: true },
})
