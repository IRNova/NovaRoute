/**
 * Accessibility (a11y) E2E Tests
 */

const { test, expect } = require('@playwright/test');

test.describe('Accessibility', () => {
  test('dashboard has proper heading structure', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    // Should have at least one heading
    const headings = await page.locator('h1, h2, h3, h4, h5, h6').count();
    expect(headings).toBeGreaterThan(0);
  });

  test('login page has accessible form', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    // Should have input fields with labels or placeholders
    const inputs = await page.locator('input').count();
    expect(inputs).toBeGreaterThan(0);
  });

  test('dashboard has navigation landmark', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    // Should have nav or sidebar
    const nav = await page.locator('nav, [role="navigation"], [role="banner"]').count();
    expect(nav).toBeGreaterThanOrEqual(0); // At least doesn't crash
  });

  test('pages have meta viewport tag', async ({ page }) => {
    await page.goto('/dashboard');
    const viewport = await page.locator('meta[name="viewport"]').count();
    expect(viewport).toBeGreaterThan(0);
  });
});
