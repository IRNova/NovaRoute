/**
 * Gamification E2E Tests
 */

const { test, expect } = require('@playwright/test');

test.describe('Gamification Dashboard', () => {
  test('gamification page loads', async ({ page }) => {
    await page.goto('/dashboard/gamification');
    await page.waitForLoadState('networkidle');
    const body = await page.textContent('body');
    expect(body.length).toBeGreaterThan(50);
  });

  test('leaderboard page loads', async ({ page }) => {
    await page.goto('/dashboard/leaderboard');
    await page.waitForLoadState('networkidle');
    const body = await page.textContent('body');
    expect(body.length).toBeGreaterThan(50);
  });

  test('gamification API responds', async ({ request }) => {
    const res = await request.get('/api/gamification');
    expect(res.status()).toBeLessThan(500);
  });
});
