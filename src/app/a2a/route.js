/**
 * A2A JSON-RPC 2.0 Router — `/a2a` endpoint
 * 
 * Methods:
 *   - message/send     — Synchronous task execution
 *   - message/stream   — SSE streaming execution
 *   - tasks/get        — Query task by ID
 *   - tasks/cancel     — Cancel task by ID
 */

const { getTaskManager } = require('@/lib/a2a/taskManager');
const { A2A_SKILL_HANDLERS, executeA2ATaskWithState } = require('@/lib/a2a/taskExecution');
const { createA2AStream, SSE_HEADERS } = require('@/lib/a2a/streaming');

// ============ JSON-RPC Helpers ============

function jsonRpcError(id, code, message, data) {
  return Response.json(
    { jsonrpc: '2.0', id, error: { code, message, data } },
    { status: code === -32600 ? 400 : code === -32601 ? 404 : code === -32603 ? 500 : 200 }
  );
}

function jsonRpcResult(id, result) {
  return Response.json({ jsonrpc: '2.0', id, result });
}

function toMessageArray(raw) {
  if (Array.isArray(raw)) {
    return raw
      .map(entry => {
        if (!entry || typeof entry !== 'object') return null;
        const role = typeof entry.role === 'string' ? entry.role : 'user';
        const content = typeof entry.content === 'string' ? entry.content : null;
        if (!content) return null;
        return { role, content };
      })
      .filter(Boolean);
  }
  return null;
}

// ============ Route Handler ============

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return jsonRpcError(null, -32700, 'Parse error: invalid JSON');
  }

  const { jsonrpc, id, method, params } = body;
  if (jsonrpc !== '2.0' || !method) {
    return jsonRpcError(id || null, -32600, 'Invalid request: missing jsonrpc or method');
  }

  const tm = getTaskManager();

  switch (method) {
    // ── message/send ──────────────────────────────────────
    case 'message/send': {
      const skill = params?.skill || 'smart-routing';
      const messages = toMessageArray(params?.messages);
      if (!messages) {
        return jsonRpcError(id, -32602, 'Invalid params: provide messages[]');
      }

      const handler = A2A_SKILL_HANDLERS[skill];
      if (!handler) {
        return jsonRpcError(id, -32601, `Unknown skill: ${skill}`);
      }

      const task = tm.createTask({ skill, messages, metadata: params?.metadata });
      try {
        tm.updateTask(task.id, 'working');
        const result = await handler(task);
        tm.updateTask(task.id, 'completed', result.artifacts);

        return jsonRpcResult(id, {
          task: { id: task.id, state: 'completed' },
          artifacts: result.artifacts,
          metadata: result.metadata,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        tm.updateTask(task.id, 'failed', [{ type: 'error', content: msg }], msg);
        return jsonRpcError(id, -32603, `Skill execution failed: ${msg}`);
      }
    }

    // ── message/stream ────────────────────────────────────
    case 'message/stream': {
      const skill = params?.skill || 'smart-routing';
      const messages = toMessageArray(params?.messages);
      if (!messages) {
        return jsonRpcError(id, -32602, 'Invalid params: provide messages[]');
      }

      const handler = A2A_SKILL_HANDLERS[skill];
      if (!handler) {
        return jsonRpcError(id, -32601, `Unknown skill: ${skill}`);
      }

      const task = tm.createTask({ skill, messages, metadata: params?.metadata });
      tm.updateTask(task.id, 'working');

      const stream = createA2AStream(
        task,
        async (t) => executeA2ATaskWithState(tm, t, handler),
        req.signal,
        { onStart: () => tm.beginStream(), onEnd: () => tm.endStream() }
      );

      return new Response(stream, { headers: SSE_HEADERS });
    }

    // ── tasks/get ─────────────────────────────────────────
    case 'tasks/get': {
      const taskId = params?.taskId || params?.id;
      if (!taskId) return jsonRpcError(id, -32602, 'Invalid params: taskId required');

      const task = tm.getTask(taskId);
      if (!task) return jsonRpcError(id, -32601, `Task not found: ${taskId}`);

      return jsonRpcResult(id, { task });
    }

    // ── tasks/cancel ──────────────────────────────────────
    case 'tasks/cancel': {
      const taskId = params?.taskId || params?.id;
      if (!taskId) return jsonRpcError(id, -32602, 'Invalid params: taskId required');

      try {
        const task = tm.cancelTask(taskId);
        return jsonRpcResult(id, { task: { id: task.id, state: task.state } });
      } catch (err) {
        return jsonRpcError(id, -32603, err.message);
      }
    }

    default:
      return jsonRpcError(id, -32601, `Method not found: ${method}`);
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      Allow: 'POST, OPTIONS',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
