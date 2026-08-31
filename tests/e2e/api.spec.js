/**
 * API E2E Tests — Tests all API endpoints respond correctly.
 */

const { test, expect } = require('@playwright/test');

test.describe('API — Core Endpoints', () => {
  test('GET /v1/models returns model list', async ({ request }) => {
    const res = await request.get('/v1/models');
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data).toHaveProperty('data');
    expect(Array.isArray(data.data)).toBeTruthy();
    expect(data.data.length).toBeGreaterThan(0);
  });

  test('POST /v1/chat/completions requires auth', async ({ request }) => {
    const res = await request.post('/v1/chat/completions', {
      data: { model: 'gpt-4', messages: [{ role: 'user', content: 'hi' }] },
    });
    expect(res.status()).toBe(401);
  });

  test('POST /v1/embeddings requires auth', async ({ request }) => {
    const res = await request.post('/v1/embeddings', {
      data: { model: 'text-embedding-3-small', input: 'hello' },
    });
    expect(res.status()).toBe(401);
  });

  test('GET /v1beta/models also works', async ({ request }) => {
    const res = await request.get('/v1beta/models');
    expect(res.ok()).toBeTruthy();
  });
});

test.describe('API — Dashboard Routes', () => {
  const apiRoutes = [
    '/api/providers',
    '/api/models',
    '/api/sessions',
    '/api/settings',
    '/api/keys',
    '/api/usage',
    '/api/health',
    '/api/plugins',
    '/api/memory',
    '/api/channels',
    '/api/voice/call',
    '/api/guardrails',
    '/api/resilience',
    '/api/gamification',
    '/api/compliance',
    '/api/monitoring',
    '/api/discovery',
    '/api/security',
    '/api/skills',
    '/api/combos',
    '/api/mcp',
    '/api/webhooks',
    '/api/costs',
    '/api/tags',
    '/api/tokens',
  ];

  for (const route of apiRoutes) {
    test(`${route} responds (may 401)`, async ({ request }) => {
      const res = await request.get(route);
      // Should respond (200, 401, 403) — never 500
      expect(res.status()).toBeLessThan(500);
    });
  }
});

test.describe('API — A2A Protocol', () => {
  test('GET /.well-known/agent.json returns agent card', async ({ request }) => {
    const res = await request.get('/.well-known/agent.json');
    expect(res.ok()).toBeTruthy();
    const card = await res.json();
    expect(card.name).toBe('NovaRoute');
    expect(card.skills.length).toBeGreaterThanOrEqual(6);
  });

  test('POST /a2a — health-report skill', async ({ request }) => {
    const res = await request.post('/a2a', {
      data: {
        jsonrpc: '2.0', id: '1',
        method: 'message/send',
        params: { skill: 'health-report', messages: [{ role: 'user', content: 'health' }] },
      },
    });
    const data = await res.json();
    expect(data.result.task.state).toBe('completed');
  });

  test('POST /a2a — list-capabilities skill', async ({ request }) => {
    const res = await request.post('/a2a', {
      data: {
        jsonrpc: '2.0', id: '2',
        method: 'message/send',
        params: { skill: 'list-capabilities', messages: [{ role: 'user', content: 'capabilities' }] },
      },
    });
    const data = await res.json();
    expect(data.result.artifacts[0].content).toContain('NovaRoute');
  });

  test('POST /a2a — provider-discovery skill', async ({ request }) => {
    const res = await request.post('/a2a', {
      data: {
        jsonrpc: '2.0', id: '3',
        method: 'message/send',
        params: { skill: 'provider-discovery', messages: [{ role: 'user', content: 'providers' }] },
      },
    });
    const data = await res.json();
    expect(data.result.task.state).toBe('completed');
  });

  test('POST /a2a — unknown skill returns -32601', async ({ request }) => {
    const res = await request.post('/a2a', {
      data: {
        jsonrpc: '2.0', id: '4',
        method: 'message/send',
        params: { skill: 'nonexistent', messages: [{ role: 'user', content: 'hi' }] },
      },
    });
    const data = await res.json();
    expect(data.error.code).toBe(-32601);
  });

  test('POST /a2a — invalid JSON-RPC returns -32700', async ({ request }) => {
    const res = await request.post('/a2a', {
      data: 'not json',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await res.json();
    expect(data.error.code).toBe(-32700);
  });

  test('POST /a2a — tasks/get after message/send', async ({ request }) => {
    const createRes = await request.post('/a2a', {
      data: {
        jsonrpc: '2.0', id: 'create',
        method: 'message/send',
        params: { skill: 'health-report', messages: [{ role: 'user', content: 'ok' }] },
      },
    });
    const { result } = await createRes.json();
    const taskId = result.task.id;

    const getRes = await request.post('/a2a', {
      data: { jsonrpc: '2.0', id: 'get', method: 'tasks/get', params: { taskId } },
    });
    const getData = await getRes.json();
    expect(getData.result.task.id).toBe(taskId);
  });
});
