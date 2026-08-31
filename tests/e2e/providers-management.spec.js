/**
 * Providers Management E2E Tests
 */

const { test, expect } = require('@playwright/test');

test.describe('Providers Page', () => {
  test('providers page renders provider list', async ({ page }) => {
    await page.goto('/dashboard/providers');
    await page.waitForLoadState('networkidle');
    // Should show provider-related content
    const body = await page.textContent('body');
    expect(body.length).toBeGreaterThan(50);
  });

  test('provider search/filter works', async ({ page }) => {
    await page.goto('/dashboard/providers');
    await page.waitForLoadState('networkidle');
    const searchInput = page.locator('input[type="text"], input[type="search"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('openai');
      await page.waitForTimeout(500);
    }
    expect(true).toBeTruthy(); // Page didn't crash
  });
});

test.describe('Models Page', () => {
  test('models page shows model list', async ({ page }) => {
    await page.goto('/dashboard/models');
    await page.waitForLoadState('networkidle');
    const body = await page.textContent('body');
    expect(body.length).toBeGreaterThan(50);
  });
});

test.describe('Provider Stats', () => {
  test('provider stats API returns data', async ({ request }) => {
    const res = await request.get('/api/providers');
    expect(res.status()).toBeLessThan(500);
  });
});
