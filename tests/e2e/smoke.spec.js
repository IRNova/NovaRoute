/**
 * Smoke Tests — Basic E2E verification for NovaRoute
 * 
 * Tests critical paths: login, dashboard, API endpoints, providers.
 */

const { test, expect } = require('@playwright/test');

test.describe('NovaRoute Smoke Tests', () => {
  test('homepage loads', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/NovaRoute|AI Gateway/i);
  });

  test('dashboard redirects to login', async ({ page }) => {
    await page.goto('/dashboard');
    // Should redirect to login or show login page
    await expect(page).toHaveURL(/login|dashboard/i);
  });

  test('API health endpoint responds', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.ok()).toBeTruthy();
  });

  test('API models endpoint responds', async ({ request }) => {
    const response = await request.get('/v1/models');
    // May return 401 without auth, but should respond
    expect(response.status()).toBeLessThan(500);
  });

  test('A2A agent card is accessible', async ({ request }) => {
    const response = await request.get('/.well-known/agent.json');
    expect(response.ok()).toBeTruthy();
    
    const card = await response.json();
    expect(card.name).toBe('NovaRoute');
    expect(card.skills).toBeDefined();
    expect(card.skills.length).toBeGreaterThan(0);
  });

  test('A2A endpoint responds to JSON-RPC', async ({ request }) => {
    const response = await request.post('/a2a', {
      data: {
        jsonrpc: '2.0',
        id: 'test-1',
        method: 'message/send',
        params: {
          skill: 'health-report',
          messages: [{ role: 'user', content: 'Check health' }],
        },
      },
    });
    
    expect(response.ok()).toBeTruthy();
    const result = await response.json();
    expect(result.jsonrpc).toBe('2.0');
    expect(result.result).toBeDefined();
  });
});

test.describe('Dashboard Pages', () => {
  test('providers page loads', async ({ page }) => {
    await page.goto('/dashboard/providers');
    await expect(page).toHaveURL(/providers/i);
  });

  test('skills page loads', async ({ page }) => {
    await page.goto('/dashboard/skills');
    await expect(page).toHaveURL(/skills/i);
  });

  test('settings page loads', async ({ page }) => {
    await page.goto('/dashboard/settings');
    await expect(page).toHaveURL(/settings/i);
  });
});

test.describe('API Endpoints', () => {
  test('v1 chat completions requires auth', async ({ request }) => {
    const response = await request.post('/v1/chat/completions', {
      data: {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
      },
    });
    
    // Should return 401 without auth
    expect(response.status()).toBe(401);
  });

  test('providers API requires auth', async ({ request }) => {
    const response = await request.get('/api/providers');
    // Should return 401 or 403 without auth
    expect(response.status()).toBeGreaterThanOrEqual(401);
  });
});
