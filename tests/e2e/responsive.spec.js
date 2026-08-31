/**
 * Responsive Design E2E Tests
 */

const { test, expect } = require('@playwright/test');

test.describe('Responsive — Desktop', () => {
  test.use({ viewport: { width: 1400, height: 900 } });

  test('dashboard renders on desktop', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    const body = await page.textContent('body');
    expect(body.length).toBeGreaterThan(50);
  });
});

test.describe('Responsive — Tablet', () => {
  test.use({ viewport: { width: 768, height: 1024 } });

  test('dashboard renders on tablet', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    const body = await page.textContent('body');
    expect(body.length).toBeGreaterThan(50);
  });
});

test.describe('Responsive — Mobile', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('dashboard renders on mobile', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    const body = await page.textContent('body');
    expect(body.length).toBeGreaterThan(50);
  });
});
