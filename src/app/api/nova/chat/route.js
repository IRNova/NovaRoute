/**
 * NovaBot Chat API — /api/nova/chat
 * 
 * GET    — List chat sessions / agents / groups
 * POST   — Send message / create session / create agent / hire / fire
 * PUT    — Update agent / group
 * DELETE — Delete session / remove agent from group
 */

const { getAgentRegistry, AgentRole, AgentPermission } = require('@/lib/nova/agentRegistry');
const { runNovaTurn } = require('@/lib/nova/orchestrator');

// GET — List sessions, agents, or groups
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action') || 'sessions';
  const registry = getAgentRegistry();

  if (action === 'agents') {
    const role = searchParams.get('role');
    const agents = role ? registry.getAgentsByRole(role) : registry.getActiveAgents();
    return Response.json({ agents });
  }

  if (action === 'agent') {
    const agentId = searchParams.get('agentId');
    const agent = registry.getAgent(agentId);
    if (!agent) return Response.json({ error: 'Agent not found' }, { status: 404 });
    return Response.json({ agent });
  }

  if (action === 'groups') {
    return Response.json({ groups: registry.getGroups() });
  }

  if (action === 'roster') {
    return Response.json({ roster: registry.getRoster() });
  }

  if (action === 'stats') {
    return Response.json(registry.stats());
  }

  if (action === 'messages') {
    const sessionId = searchParams.get('sessionId');
    const session = registry.chatSessions.get(sessionId);
    if (!session) return Response.json({ error: 'Session not found' }, { status: 404 });
    return Response.json({ messages: session.messages, session });
  }

  // Default: list all sessions
  const agentId = searchParams.get('agentId');
  const sessions = agentId
    ? registry.getAgentSessions(agentId)
    : [...registry.chatSessions.values()];

  return Response.json({ sessions });
}

// POST — Send message, create session, hire, fire
export async function POST(req) {
  try {
    const body = await req.json();
    const { action } = body;
    const registry = getAgentRegistry();

    if (action === 'send') {
      const { sessionId, senderId, content, agentId: targetAgentId, tag } = body;

      // If no session, create a direct chat with the target agent
      let session;
      if (sessionId) {
        session = registry.chatSessions.get(sessionId);
      } else if (targetAgentId) {
        // Create direct session
        session = registry.createChatSession('direct', [senderId || 'user', targetAgentId]);
      }

      if (!session) return Response.json({ error: 'Session or agentId required' }, { status: 400 });

      // Store user message with optional tag
      const userMsg = await registry.sendMessage(session.id, senderId || 'user', content, { tag });

      // Run NovaBot turn for AI response
      let aiResponse = null;
      const notifications = [];
      try {
        const events = [];
        await runNovaTurn({
          sessionId: session.id,
          text: content,
          onEvent: (event) => {
            events.push(event);
            // Capture hire/fire notifications
            if (event.phase === 'absence-alert') {
              notifications.push({ type: 'fire', message: event.note });
            }
            if (event.note && event.note.includes('New agent hired')) {
              notifications.push({ type: 'hire', message: event.note });
            }
            if (event.note && event.note.includes('Agent fired')) {
              notifications.push({ type: 'fire', message: event.note });
            }
            if (event.note && event.note.includes('Replacement hired')) {
              notifications.push({ type: 'hire', message: event.note });
            }
          },
        });

        // Get the last agent message
        const agentMessages = session.messages.filter(m => m.senderId !== 'user');
        if (agentMessages.length > 0) {
          aiResponse = agentMessages[agentMessages.length - 1];
        }
      } catch (err) {
        aiResponse = await registry.sendMessage(session.id, 'system', `Error: ${err.message}`, { type: 'error' });
      }

      return Response.json({
        success: true,
        userMessage: userMsg,
        aiResponse,
        notifications,
        session: { id: session.id, name: session.name },
      });
    }

    if (action === 'create_session') {
      const { type, participantIds, name } = body;
      const session = registry.createChatSession(type || 'direct', participantIds || [], name);
      return Response.json({ success: true, session });
    }

    if (action === 'hire') {
      const { hiringAgentId, name, role, specialty, tools, systemPrompt } = body;
      const newAgent = registry.hireAgent(hiringAgentId || 'ceo-default', {
        name, role, specialty, tools, systemPrompt,
      });
      return Response.json({ success: true, agent: newAgent });
    }

    if (action === 'fire') {
      const { firingAgentId, targetAgentId, reason } = body;
      const fired = registry.fireAgent(
        firingAgentId || 'ceo-default',
        targetAgentId,
        reason || ''
      );
      return Response.json({ success: true, agent: fired });
    }

    if (action === 'update_agent') {
      const { agentId, ...updates } = body;
      const agent = registry.getAgent(agentId);
      if (!agent) return Response.json({ error: 'Agent not found' }, { status: 404 });
      Object.assign(agent, updates, { updatedAt: new Date().toISOString() });
      return Response.json({ success: true, agent });
    }

    if (action === 'create_group') {
      const { name, description, memberIds, createdBy } = body;
      const group = registry.createGroup({ name, description, memberIds, createdBy });
      return Response.json({ success: true, group });
    }

    if (action === 'add_to_group') {
      const { agentId, groupId } = body;
      registry.addToGroup(agentId, groupId);
      return Response.json({ success: true });
    }

    if (action === 'remove_from_group') {
      const { agentId, groupId } = body;
      registry.removeFromGroup(agentId, groupId);
      return Response.json({ success: true });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
