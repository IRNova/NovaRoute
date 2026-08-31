/**
 * Playwright E2E Test Configuration for NovaRoute
 * 
 * Based on OmniRoute's playwright.config.ts, adapted for NovaRoute.
 */

const { defineConfig, devices } = require('@playwright/test');

const dashboardPort = process.env.PORT || '20126';
const dashboardBaseUrl = `http://localhost:${dashboardPort}`;

module.exports = defineConfig({
  testDir: './tests/e2e',
  testMatch: ['**/*.spec.js'],
  
  fullyParallel: false,
  timeout: 180_000,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  
  reporter: process.env.CI ? 'line' : 'html',
  
  expect: {
    timeout: process.env.CI ? 30_000 : 10_000,
  },
  
  use: {
    baseURL: dashboardBaseUrl,
    navigationTimeout: 300_000,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  
  webServer: {
    command: `npm run start`,
    url: `${dashboardBaseUrl}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
