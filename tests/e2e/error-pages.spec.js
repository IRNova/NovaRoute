/**
 * Error Pages E2E Tests
 */

const { test, expect } = require('@playwright/test');

test.describe('Error Handling', () => {
  test('404 page for non-existent route', async ({ page }) => {
    const res = await page.goto('/nonexistent-page-xyz');
    // Should not crash the app
    const body = await page.textContent('body');
    expect(body).toBeTruthy();
  });

  test('non-existent API returns proper error', async ({ request }) => {
    const res = await request.get('/api/nonexistent-xyz');
    expect(res.status()).toBeGreaterThanOrEqual(400);
    expect(res.status()).toBeLessThan(500);
  });

  test('setup page loads', async ({ page }) => {
    await page.goto('/setup');
    await page.waitForLoadState('networkidle');
    const body = await page.textContent('body');
    expect(body.length).toBeGreaterThan(10);
  });

  test('login page loads', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    const body = await page.textContent('body');
    expect(body.length).toBeGreaterThan(10);
  });

  test('landing page loads', async ({ page }) => {
    await page.goto('/landing');
    await page.waitForLoadState('networkidle');
    const body = await page.textContent('body');
    expect(body.length).toBeGreaterThan(10);
  });
});
