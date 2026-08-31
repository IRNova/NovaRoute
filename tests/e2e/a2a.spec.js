/**
 * A2A Protocol E2E Tests
 * 
 * Tests the Agent-to-Agent protocol implementation.
 */

const { test, expect } = require('@playwright/test');

test.describe('A2A Protocol', () => {
  test('agent card is discoverable', async ({ request }) => {
    const response = await request.get('/.well-known/agent.json');
    expect(response.ok()).toBeTruthy();
    
    const card = await response.json();
    expect(card).toMatchObject({
      name: 'NovaRoute',
      url: expect.stringContaining('/a2a'),
      version: expect.any(String),
      capabilities: {
        streaming: true,
      },
      skills: expect.arrayContaining([
        expect.objectContaining({
          id: 'smart-routing',
          name: 'Smart Routing',
        }),
      ]),
    });
  });

  test('message/send executes smart-routing skill', async ({ request }) => {
    const response = await request.post('/a2a', {
      data: {
        jsonrpc: '2.0',
        id: 'test-smart-routing',
        method: 'message/send',
        params: {
          skill: 'smart-routing',
          messages: [{ role: 'user', content: 'Say hello in one word' }],
        },
      },
    });

    expect(response.ok()).toBeTruthy();
    const result = await response.json();
    
    expect(result).toMatchObject({
      jsonrpc: '2.0',
      id: 'test-smart-routing',
      result: {
        task: {
          id: expect.any(String),
          state: 'completed',
        },
        artifacts: expect.arrayContaining([
          expect.objectContaining({ type: 'text', content: expect.any(String) }),
        ]),
        metadata: expect.objectContaining({
          routing_explanation: expect.any(String),
          cost_envelope: expect.any(Object),
        }),
      },
    });
  });

  test('message/send executes health-report skill', async ({ request }) => {
    const response = await request.post('/a2a', {
      data: {
        jsonrpc: '2.0',
        id: 'test-health',
        method: 'message/send',
        params: {
          skill: 'health-report',
          messages: [{ role: 'user', content: 'Health check' }],
        },
      },
    });

    expect(response.ok()).toBeTruthy();
    const result = await response.json();
    expect(result.result.task.state).toBe('completed');
    expect(result.result.artifacts[0].content).toContain('NovaRoute');
  });

  test('message/send executes list-capabilities skill', async ({ request }) => {
    const response = await request.post('/a2a', {
      data: {
        jsonrpc: '2.0',
        id: 'test-caps',
        method: 'message/send',
        params: {
          skill: 'list-capabilities',
          messages: [{ role: 'user', content: 'What can you do?' }],
        },
      },
    });

    expect(response.ok()).toBeTruthy();
    const result = await response.json();
    expect(result.result.artifacts[0].content).toContain('Smart Routing');
  });

  test('unknown skill returns error', async ({ request }) => {
    const response = await request.post('/a2a', {
      data: {
        jsonrpc: '2.0',
        id: 'test-unknown',
        method: 'message/send',
        params: {
          skill: 'nonexistent-skill',
          messages: [{ role: 'user', content: 'Hello' }],
        },
      },
    });

    const result = await response.json();
    expect(result.error).toBeDefined();
    expect(result.error.code).toBe(-32601);
  });

  test('invalid JSON-RPC returns parse error', async ({ request }) => {
    const response = await request.post('/a2a', {
      data: 'not json',
      headers: { 'Content-Type': 'application/json' },
    });

    const result = await response.json();
    expect(result.error.code).toBe(-32700);
  });

  test('tasks/get retrieves task by ID', async ({ request }) => {
    // First create a task
    const createResponse = await request.post('/a2a', {
      data: {
        jsonrpc: '2.0',
        id: 'create-1',
        method: 'message/send',
        params: {
          skill: 'health-report',
          messages: [{ role: 'user', content: 'Health' }],
        },
      },
    });
    
    const createResult = await createResponse.json();
    const taskId = createResult.result.task.id;

    // Then retrieve it
    const getResponse = await request.post('/a2a', {
      data: {
        jsonrpc: '2.0',
        id: 'get-1',
        method: 'tasks/get',
        params: { taskId },
      },
    });

    expect(getResponse.ok()).toBeTruthy();
    const getResult = await getResponse.json();
    expect(getResult.result.task.id).toBe(taskId);
  });
});
