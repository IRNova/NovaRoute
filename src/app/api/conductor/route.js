/**
 * Conductor API — /api/conductor
 * 
 * GET    — System status & fleet overview
 * POST   — Register agent / dispatch task
 * DELETE — Unregister agent / shutdown
 */

const { getConductor } = require('@/lib/conductor/conductor');

// GET — Status
export async function GET(req) {
  const conductor = getConductor();
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action') || 'status';

  if (action === 'agents') {
    const state = searchParams.get('state');
    return Response.json({ agents: conductor.registry.getAll({ state }) });
  }

  if (action === 'tasks') {
    return Response.json({ tasks: conductor.dispatcher.getActive() });
  }

  if (action === 'fleet') {
    return Response.json(conductor.registry.stats());
  }

  return Response.json(conductor.status());
}

// POST — Register agent or dispatch task
export async function POST(req) {
  try {
    const body = await req.json();
    const { action, agent, task } = body;
    const conductor = getConductor();

    if (action === 'register') {
      const registered = conductor.registry.register(agent);
      return Response.json({ success: true, agent: registered });
    }

    if (action === 'dispatch') {
      const dispatch = await conductor.dispatcher.dispatch(task);
      return Response.json({ success: true, dispatch });
    }

    if (action === 'heartbeat') {
      conductor.registry.heartbeat(body.agentId);
      return Response.json({ success: true });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

// DELETE — Unregister agent
export async function DELETE(req) {
  const { searchParams } = new URL(req.url);
  const agentId = searchParams.get('agentId');

  if (!agentId) {
    return Response.json({ error: 'agentId required' }, { status: 400 });
  }

  const conductor = getConductor();
  const removed = conductor.registry.unregister(agentId);

  return Response.json({ success: removed, agentId });
}
