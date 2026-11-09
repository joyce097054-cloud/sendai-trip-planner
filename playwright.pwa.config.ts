import { chromium, defineConfig } from '@playwright/test'
import { existsSync } from 'node:fs'
const executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH ?? (!existsSync(chromium.executablePath()) && existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined)
export default defineConfig({
  outputDir: 'test-results/pwa', testDir: './tests', testMatch: 'pwa.pw.ts', workers: 1, timeout: 45_000,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4181/sendai-trip-planner/', serviceWorkers: 'allow', trace: 'retain-on-failure', screenshot: 'only-on-failure', launchOptions: { executablePath }, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
  webServer: { command: 'node scripts/test-pages-server.mjs', url: 'http://127.0.0.1:4181/sendai-trip-planner/', reuseExistingServer: false, env: { SENDAI_TEST_PORT: '4181', SENDAI_PWA_TEST: '1' } },
})
