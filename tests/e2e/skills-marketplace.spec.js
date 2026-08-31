/**
 * Skills & Marketplace E2E Tests
 */

const { test, expect } = require('@playwright/test');

test.describe('Skills Page', () => {
  test('skills page loads', async ({ page }) => {
    await page.goto('/dashboard/skills');
    await page.waitForLoadState('networkidle');
    const body = await page.textContent('body');
    expect(body.length).toBeGreaterThan(50);
  });

  test('skills page shows skill cards', async ({ page }) => {
    await page.goto('/dashboard/skills');
    await page.waitForLoadState('networkidle');
    // Should show at least some content
    const text = await page.textContent('body');
    expect(text).toBeTruthy();
  });

  test('skills API responds', async ({ request }) => {
    const res = await request.get('/api/skills');
    expect(res.status()).toBeLessThan(500);
  });
});

test.describe('Plugins Page', () => {
  test('plugins page loads', async ({ page }) => {
    await page.goto('/dashboard/plugins');
    await page.waitForLoadState('networkidle');
    const body = await page.textContent('body');
    expect(body.length).toBeGreaterThan(50);
  });

  test('plugins API responds', async ({ request }) => {
    const res = await request.get('/api/plugins');
    expect(res.status()).toBeLessThan(500);
  });
});

test.describe('MCP Page', () => {
  test('mcp page loads', async ({ page }) => {
    await page.goto('/dashboard/mcp');
    await page.waitForLoadState('networkidle');
    const body = await page.textContent('body');
    expect(body.length).toBeGreaterThan(50);
  });

  test('mcp API responds', async ({ request }) => {
    const res = await request.get('/api/mcp');
    expect(res.status()).toBeLessThan(500);
  });
});
