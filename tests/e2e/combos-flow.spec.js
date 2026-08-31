/**
 * Combos Flow E2E Tests
 */

const { test, expect } = require('@playwright/test');

test.describe('Combos Dashboard', () => {
  test('combos page loads', async ({ page }) => {
    await page.goto('/dashboard/combos');
    await page.waitForLoadState('networkidle');
    const body = await page.textContent('body');
    expect(body.length).toBeGreaterThan(50);
  });

  test('combos API responds', async ({ request }) => {
    const res = await request.get('/api/combos');
    expect(res.status()).toBeLessThan(500);
  });

  test('routing-stats API responds', async ({ request }) => {
    const res = await request.get('/api/routing-stats');
    expect(res.status()).toBeLessThan(500);
  });
});

test.describe('Discovery Dashboard', () => {
  test('discovery page loads', async ({ page }) => {
    await page.goto('/dashboard/discovery');
    await page.waitForLoadState('networkidle');
    const body = await page.textContent('body');
    expect(body.length).toBeGreaterThan(50);
  });

  test('discovery API responds', async ({ request }) => {
    const res = await request.get('/api/discovery');
    expect(res.status()).toBeLessThan(500);
  });
});

test.describe('Webhooks', () => {
  test('webhooks page loads', async ({ page }) => {
    await page.goto('/dashboard/webhooks');
    await page.waitForLoadState('networkidle');
    const body = await page.textContent('body');
    expect(body.length).toBeGreaterThan(50);
  });

  test('webhooks API responds', async ({ request }) => {
    const res = await request.get('/api/webhooks');
    expect(res.status()).toBeLessThan(500);
  });
});
