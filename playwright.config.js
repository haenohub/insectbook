import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';
export default defineConfig({
  testDir: './tests',
  testMatch: 'web-*.spec.js',
  timeout: 45000,
  workers: 1,
  use: { baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5173', viewport: { width: 1440, height: 1050 }, headless: true, launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined), args: ['--no-sandbox', '--disable-dev-shm-usage'] }, screenshot: 'only-on-failure' },
});
