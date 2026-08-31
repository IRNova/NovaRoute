/**
 * Memory Engine E2E Tests
 */

const { test, expect } = require('@playwright/test');

test.describe('Memory Dashboard', () => {
  test('memory page loads', async ({ page }) => {
    await page.goto('/dashboard/memory');
    await page.waitForLoadState('networkidle');
    const body = await page.textContent('body');
    expect(body.length).toBeGreaterThan(50);
  });

  test('memory API responds', async ({ request }) => {
    const res = await request.get('/api/memory');
    expect(res.status()).toBeLessThan(500);
  });

  test('memory API POST (store)', async ({ request }) => {
    const res = await request.post('/api/memory', {
      data: { type: 'factual', content: 'Test memory entry' },
    });
    // May return 401 (auth) or 200 — but not 500
    expect(res.status()).toBeLessThan(500);
  });
});

test.describe('Voice System', () => {
  test('voice API responds', async ({ request }) => {
    const res = await request.get('/api/voice/call');
    expect(res.status()).toBeLessThan(500);
  });
});

test.describe('Channels System', () => {
  test('channels API responds', async ({ request }) => {
    const res = await request.get('/api/channels');
    expect(res.status()).toBeLessThan(500);
  });
});
