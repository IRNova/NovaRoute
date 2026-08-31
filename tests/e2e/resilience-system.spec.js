/**
 * Resilience System E2E Tests
 */

const { test, expect } = require('@playwright/test');

test.describe('Resilience Dashboard', () => {
  test('resilience page loads', async ({ page }) => {
    await page.goto('/dashboard/resilience');
    await page.waitForLoadState('networkidle');
    const body = await page.textContent('body');
    expect(body.length).toBeGreaterThan(50);
  });

  test('resilience API responds', async ({ request }) => {
    const res = await request.get('/api/resilience');
    expect(res.status()).toBeLessThan(500);
  });
});

test.describe('Guardrails System', () => {
  test('guardrails API responds', async ({ request }) => {
    const res = await request.get('/api/guardrails');
    expect(res.status()).toBeLessThan(500);
  });
});

test.describe('Monitoring Dashboard', () => {
  test('health page loads', async ({ page }) => {
    await page.goto('/dashboard/health');
    await page.waitForLoadState('networkidle');
    const body = await page.textContent('body');
    expect(body.length).toBeGreaterThan(50);
  });

  test('monitoring API responds', async ({ request }) => {
    const res = await request.get('/api/monitoring');
    expect(res.status()).toBeLessThan(500);
  });

  test('health API endpoint', async ({ request }) => {
    const res = await request.get('/api/health');
    expect(res.ok()).toBeTruthy();
  });
});

test.describe('Compliance System', () => {
  test('compliance page loads', async ({ page }) => {
    await page.goto('/dashboard/compliance');
    await page.waitForLoadState('networkidle');
    const body = await page.textContent('body');
    expect(body.length).toBeGreaterThan(50);
  });

  test('compliance API responds', async ({ request }) => {
    const res = await request.get('/api/compliance');
    expect(res.status()).toBeLessThan(500);
  });
});
