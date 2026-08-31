/**
 * Settings & Toggles E2E Tests
 */

const { test, expect } = require('@playwright/test');

test.describe('Settings Page', () => {
  test('settings page loads', async ({ page }) => {
    await page.goto('/dashboard/settings');
    await page.waitForLoadState('networkidle');
    const body = await page.textContent('body');
    expect(body.length).toBeGreaterThan(50);
  });

  test('settings page has form elements', async ({ page }) => {
    await page.goto('/dashboard/settings');
    await page.waitForLoadState('networkidle');
    // Should have some interactive elements
    const inputs = await page.locator('input, select, button').count();
    expect(inputs).toBeGreaterThan(0);
  });
});

test.describe('API Keys', () => {
  test('api-keys page loads', async ({ page }) => {
    await page.goto('/dashboard/api-keys');
    await page.waitForLoadState('networkidle');
    const body = await page.textContent('body');
    expect(body.length).toBeGreaterThan(50);
  });
});

test.describe('Usage Page', () => {
  test('usage page loads', async ({ page }) => {
    await page.goto('/dashboard/usage');
    await page.waitForLoadState('networkidle');
    const body = await page.textContent('body');
    expect(body.length).toBeGreaterThan(50);
  });
});

test.describe('Sessions Page', () => {
  test('sessions page loads', async ({ page }) => {
    await page.goto('/dashboard/sessions');
    await page.waitForLoadState('networkidle');
    const body = await page.textContent('body');
    expect(body.length).toBeGreaterThan(50);
  });
});

test.describe('Logs Page', () => {
  test('logs page loads', async ({ page }) => {
    await page.goto('/dashboard/logs');
    await page.waitForLoadState('networkidle');
    const body = await page.textContent('body');
    expect(body.length).toBeGreaterThan(50);
  });
});
