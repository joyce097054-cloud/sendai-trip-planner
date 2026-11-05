import { defineConfig, chromium } from '@playwright/test'
import { existsSync } from 'node:fs'

const executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH ?? (existsSync(chromium.executablePath()) ? undefined : existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined)
export default defineConfig({
  outputDir: 'test-results/portable',
  testDir: './tests', testMatch: 'portable.pw.ts', workers: 1, timeout: 30000,
  use: { browserName: 'chromium', viewport: { width: 1366, height: 900 }, launchOptions: { executablePath }, trace: 'retain-on-failure' },
})
