/**
 * NovaBot Groups API — /api/nova/groups
 * 
 * GET    — List groups / get group details
 * POST   — Create group / add member / remove member
 * DELETE — Delete group
 */

const { getAgentRegistry } = require('@/lib/nova/agentRegistry');

// GET — List groups
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action') || 'list';
  const registry = getAgentRegistry();

  if (action === 'detail') {
    const groupId = searchParams.get('groupId');
    const group = registry.getGroup(groupId);
    if (!group) return Response.json({ error: 'Group not found' }, { status: 404 });

    // Enrich with agent details
    const members = group.memberIds
      .map(id => registry.getAgent(id))
      .filter(Boolean)
      .map(a => ({ id: a.id, name: a.name, role: a.role, status: a.status }));

    return Response.json({ group: { ...group, members } });
  }

  return Response.json({ groups: registry.getGroups() });
}

// POST — Create group or manage members
export async function POST(req) {
  try {
    const body = await req.json();
    const { action } = body;
    const registry = getAgentRegistry();

    if (action === 'create') {
      const { name, description, memberIds, createdBy } = body;
      if (!name) return Response.json({ error: 'Name required' }, { status: 400 });

      const group = registry.createGroup({
        name,
        description: description || '',
        memberIds: memberIds || [],
        createdBy: createdBy || 'ceo-default',
      });

      return Response.json({ success: true, group });
    }

    if (action === 'add_member') {
      const { groupId, agentId } = body;
      registry.addToGroup(agentId, groupId);
      return Response.json({ success: true });
    }

    if (action === 'remove_member') {
      const { groupId, agentId } = body;
      registry.removeFromGroup(agentId, groupId);
      return Response.json({ success: true });
    }

    if (action === 'send_group_message') {
      const { groupId, senderId, content } = body;
      const session = registry.createChatSession('group', [senderId, ...registry.getGroup(groupId)?.memberIds || []], registry.getGroup(groupId)?.name);
      const message = await registry.sendMessage(session.id, senderId, content);
      return Response.json({ success: true, message, sessionId: session.id });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
