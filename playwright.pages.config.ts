import { chromium, defineConfig } from '@playwright/test'
import { existsSync } from 'node:fs'

const executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH ??
  (!existsSync(chromium.executablePath()) && existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined)

export default defineConfig({
  testDir: './tests', testMatch: 'pages.pw.ts', timeout: 30_000,
  workers: 1, reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4180/sendai-trip-planner/',
    trace: 'retain-on-failure', screenshot: 'only-on-failure',
    launchOptions: { executablePath },
  },
  projects: [
    { name: 'mobile', use: { browserName: 'chromium', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    { name: 'desktop', use: { browserName: 'chromium', viewport: { width: 1440, height: 1000 } } },
  ],
  webServer: {
    command: 'node scripts/test-pages-server.mjs',
    url: 'http://127.0.0.1:4180/sendai-trip-planner/',
    reuseExistingServer: false,
  },
})
