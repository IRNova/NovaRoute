/**
 * Agent Registry — Full agent management system
 * 
 * Manages agents with roles, permissions, groups, and self-organization.
 * Agents can hire/fire, create groups, and collaborate like a real team.
 */

const crypto = require('crypto');
const { EventEmitter } = require('events');

// ============ Agent Roles ============

const AgentRole = {
  CEO: 'ceo',
  SUPERVISOR: 'supervisor',
  EMPLOYEE: 'employee',
  INTERN: 'intern',
  CONTRACTOR: 'contractor',
};

// ============ Agent Permissions ============

const AgentPermission = {
  TERMINAL: 'terminal',
  BROWSER: 'browser',
  HIRE: 'hire',
  FIRE: 'fire',
  CREATE_GROUP: 'create_group',
  MANAGE_AGENTS: 'manage_agents',
  ACCESS_ALL: 'access_all',
  FILE_READ: 'file_read',
  FILE_WRITE: 'file_write',
  DATABASE: 'database',
  API: 'api',
  DEPLOY: 'deploy',
  MONITOR: 'monitor',
};

// ============ Default Permission Sets ============

const ROLE_PERMISSIONS = {
  [AgentRole.CEO]: [
    AgentPermission.TERMINAL,
    AgentPermission.BROWSER,
    AgentPermission.HIRE,
    AgentPermission.FIRE,
    AgentPermission.CREATE_GROUP,
    AgentPermission.MANAGE_AGENTS,
    AgentPermission.ACCESS_ALL,
    AgentPermission.FILE_READ,
    AgentPermission.FILE_WRITE,
    AgentPermission.DATABASE,
    AgentPermission.API,
    AgentPermission.DEPLOY,
    AgentPermission.MONITOR,
  ],
  [AgentRole.SUPERVISOR]: [
    AgentPermission.TERMINAL,
    AgentPermission.BROWSER,
    AgentPermission.FILE_READ,
    AgentPermission.MONITOR,
    AgentPermission.API,
  ],
  [AgentRole.EMPLOYEE]: [
    AgentPermission.TERMINAL,
    AgentPermission.BROWSER,
    AgentPermission.FILE_READ,
    AgentPermission.FILE_WRITE,
  ],
  [AgentRole.INTERN]: [
    AgentPermission.FILE_READ,
    AgentPermission.BROWSER,
  ],
  [AgentRole.CONTRACTOR]: [
    AgentPermission.TERMINAL,
    AgentPermission.BROWSER,
    AgentPermission.FILE_READ,
  ],
};

// ============ Agent Registry ============

class AgentRegistry extends EventEmitter {
  constructor() {
    super();
    /** @type {Map<string, Agent>} */
    this.agents = new Map();
    /** @type {Map<string, AgentGroup>} */
    this.groups = new Map();
    /** @type {Map<string, ChatSession>} */
    this.chatSessions = new Map();
    this._loadDefaults();
  }

  _loadDefaults() {
    // Default CEO
    this.createAgent({
      id: 'ceo-default',
      name: 'رئیس (CEO)',
      role: AgentRole.CEO,
      specialty: ' مدیریت استراتژیک، تصمیم‌گیری، رهبری تیم',
      systemPrompt: 'تو مدیر عامل شرکت Nova هستی. تصمیمات استراتژیک بگیر، تیم رو رهبری کن، و بهترین نتیجه رو تحویل بده.',
      modelId: 'auto',
      status: 'active',
    });

    // Default Supervisor
    this.createAgent({
      id: 'supervisor-default',
      name: 'ناظرن (Supervisor)',
      role: AgentRole.SUPERVISOR,
      specialty: 'کنترل کیفیت، بررسی کارها، اطمینان از دقت',
      systemPrompt: 'تو ناظر کیفیت شرکت هستی. کارهای کارمندان رو بررسی کن، کیفیت رو تضمین کن.',
      modelId: 'auto',
      status: 'active',
    });

    // Default Employees
    const employees = [
      { name: 'برنامه‌نویس (Developer)', specialty: 'برنامه‌نویسی، کدنویسی، دیباگ', tools: 'terminal,browser' },
      { name: 'تحلیلگر (Analyst)', specialty: 'تحلیل داده، گزارش‌دهی، تحقیق', tools: 'browser' },
      { name: 'طراح (Designer)', specialty: 'طراحی UI/UX، خلاقیت', tools: 'browser' },
      { name: ' DevOps', specialty: 'استقرار، سرور، مانیتورینگ', tools: 'terminal,browser' },
    ];

    for (const emp of employees) {
      this.createAgent({
        id: `emp-${emp.name.split(' ')[0].toLowerCase()}`,
        name: emp.name,
        role: AgentRole.EMPLOYEE,
        specialty: emp.specialty,
        tools: emp.tools,
        modelId: 'auto',
        status: 'active',
      });
    }

    // Default Group
    this.createGroup({
      id: 'general',
      name: 'گروه عمومی',
      description: 'گروه اصلی شرکت — همه اعضا',
      memberIds: ['ceo-default', 'supervisor-default', 'emp-developer', 'emp-analyst', 'emp-designer', 'emp-devops'],
      createdBy: 'ceo-default',
    });
  }

  /**
   * Create a new agent
   */
  createAgent(options = {}) {
    const agent = {
      id: options.id || crypto.randomUUID(),
      name: options.name || 'Agent',
      role: options.role || AgentRole.EMPLOYEE,
      specialty: options.specialty || '',
      systemPrompt: options.systemPrompt || '',
      modelId: options.modelId || 'auto',
      providerId: options.providerId || null,
      tools: options.tools || '',
      permissions: options.permissions || ROLE_PERMISSIONS[options.role] || ROLE_PERMISSIONS[AgentRole.EMPLOYEE],
      status: options.status || 'active',
      avatar: options.avatar || null,
      metadata: options.metadata || {},
      groupIds: options.groupIds || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastActiveAt: null,
      tasksCompleted: 0,
      tasksFailed: 0,
      avgResponseTime: 0,
      hiredBy: options.hiredBy || null,
    };

    this.agents.set(agent.id, agent);
    this.emit('agent:created', agent);
    return agent;
  }

  /**
   * CEO hires a new employee
   */
  hireAgent(hiringAgentId, options = {}) {
    const hiringAgent = this.agents.get(hiringAgentId);
    if (!hiringAgent) throw new Error('Hiring agent not found');
    if (!hiringAgent.permissions.includes(AgentPermission.HIRE)) {
      throw new Error('This agent cannot hire new agents');
    }

    const newAgent = this.createAgent({
      ...options,
      role: options.role || AgentRole.EMPLOYEE,
      hiredBy: hiringAgentId,
    });

    this.emit('agent:hired', { hiringAgent: hiringAgent.name, newAgent: newAgent.name });
    return newAgent;
  }

  /**
   * CEO fires an employee
   */
  fireAgent(firingAgentId, targetAgentId, reason = '') {
    const firingAgent = this.agents.get(firingAgentId);
    if (!firingAgent) throw new Error('Firing agent not found');
    if (!firingAgent.permissions.includes(AgentPermission.FIRE)) {
      throw new Error('This agent cannot fire agents');
    }

    const target = this.agents.get(targetAgentId);
    if (!target) throw new Error('Target agent not found');
    if (target.role === AgentRole.CEO) throw new Error('Cannot fire the CEO');

    target.status = 'fired';
    target.metadata.firedAt = new Date().toISOString();
    target.metadata.firedBy = firingAgentId;
    target.metadata.firedReason = reason;

    this.emit('agent:fired', { firingAgent: firingAgent.name, target: target.name, reason });
    return target;
  }

  /**
   * Update agent permissions
   */
  updatePermissions(updatingAgentId, targetAgentId, permissions) {
    const updater = this.agents.get(updatingAgentId);
    if (!updater) throw new Error('Updater agent not found');
    if (!updater.permissions.includes(AgentPermission.MANAGE_AGENTS)) {
      throw new Error('This agent cannot manage permissions');
    }

    const target = this.agents.get(targetAgentId);
    if (!target) throw new Error('Target agent not found');

    target.permissions = permissions;
    target.updatedAt = new Date().toISOString();
    return target;
  }

  /**
   * Create a group
   */
  createGroup(options = {}) {
    const group = {
      id: options.id || crypto.randomUUID(),
      name: options.name || 'New Group',
      description: options.description || '',
      memberIds: options.memberIds || [],
      createdBy: options.createdBy || null,
      permissions: options.permissions || [],
      createdAt: new Date().toISOString(),
      metadata: options.metadata || {},
    };

    this.groups.set(group.id, group);

    // Add group to agents
    for (const memberId of group.memberIds) {
      const agent = this.agents.get(memberId);
      if (agent && !agent.groupIds.includes(group.id)) {
        agent.groupIds.push(group.id);
      }
    }

    this.emit('group:created', group);
    return group;
  }

  /**
   * Add agent to group
   */
  addToGroup(agentId, groupId) {
    const agent = this.agents.get(agentId);
    const group = this.groups.get(groupId);
    if (!agent || !group) throw new Error('Agent or group not found');

    if (!group.memberIds.includes(agentId)) {
      group.memberIds.push(agentId);
    }
    if (!agent.groupIds.includes(groupId)) {
      agent.groupIds.push(groupId);
    }

    this.emit('group:member-added', { groupId, agentId });
  }

  /**
   * Remove agent from group
   */
  removeFromGroup(agentId, groupId) {
    const agent = this.agents.get(agentId);
    const group = this.groups.get(groupId);
    if (!agent || !group) return;

    group.memberIds = group.memberIds.filter(id => id !== agentId);
    agent.groupIds = agent.groupIds.filter(id => id !== groupId);

    this.emit('group:member-removed', { groupId, agentId });
  }

  /**
   * Create a chat session (1-on-1 or group)
   */
  createChatSession(type, participantIds, name = null) {
    const sessionId = `chat-${crypto.randomUUID().slice(0, 8)}`;
    const session = {
      id: sessionId,
      type, // 'direct' | 'group'
      name: name || this._generateChatName(participantIds),
      participantIds,
      messages: [],
      createdAt: new Date().toISOString(),
      lastMessageAt: null,
      unreadCounts: {},
    };

    this.chatSessions.set(sessionId, session);
    return session;
  }

  /**
   * Send a message in a chat session
   */
  async sendMessage(sessionId, senderId, content, options = {}) {
    const session = this.chatSessions.get(sessionId);
    if (!session) throw new Error('Chat session not found');

    const message = {
      id: crypto.randomUUID(),
      sessionId,
      senderId,
      senderName: this.agents.get(senderId)?.name || 'System',
      content,
      type: options.type || 'message',
      tag: options.tag || null,
      timestamp: new Date().toISOString(),
      metadata: options.metadata || {},
    };

    session.messages.push(message);
    session.lastMessageAt = message.timestamp;

    // Update unread counts
    for (const participantId of session.participantIds) {
      if (participantId !== senderId) {
        session.unreadCounts[participantId] = (session.unreadCounts[participantId] || 0) + 1;
      }
    }

    this.emit('message:sent', message);
    return message;
  }

  /**
   * Get agent by ID
   */
  getAgent(agentId) {
    return this.agents.get(agentId);
  }

  /**
   * Get all active agents
   */
  getActiveAgents() {
    return [...this.agents.values()].filter(a => a.status === 'active');
  }

  /**
   * Get agents by role
   */
  getAgentsByRole(role) {
    return [...this.agents.values()].filter(a => a.role === role && a.status === 'active');
  }

  /**
   * Get group by ID
   */
  getGroup(groupId) {
    return this.groups.get(groupId);
  }

  /**
   * Get all groups
   */
  getGroups() {
    return [...this.groups.values()];
  }

  /**
   * Get chat sessions for an agent
   */
  getAgentSessions(agentId) {
    return [...this.chatSessions.values()].filter(s => s.participantIds.includes(agentId));
  }

  /**
   * Get full roster (for CEO system prompt)
   */
  getRoster() {
    const agents = this.getActiveAgents();
    return agents.map(a => ({
      id: a.id,
      name: a.name,
      role: a.role,
      specialty: a.specialty,
      permissions: a.permissions,
      tools: a.tools,
      groups: a.groupIds.map(gId => this.groups.get(gId)?.name).filter(Boolean),
    }));
  }

  _generateChatName(participantIds) {
    const names = participantIds
      .map(id => this.agents.get(id)?.name?.split(' ')[0] || 'Unknown')
      .slice(0, 3);
    return names.join(', ');
  }

  /**
   * Get stats
   */
  stats() {
    const agents = [...this.agents.values()];
    return {
      total: agents.length,
      active: agents.filter(a => a.status === 'active').length,
      fired: agents.filter(a => a.status === 'fired').length,
      byRole: Object.values(AgentRole).reduce((acc, role) => {
        acc[role] = agents.filter(a => a.role === role).length;
        return acc;
      }, {}),
      groups: this.groups.size,
      chatSessions: this.chatSessions.size,
    };
  }
}

// Singleton
let _instance = null;

function getAgentRegistry() {
  if (!_instance) _instance = new AgentRegistry();
  return _instance;
}

module.exports = {
  AgentRole,
  AgentPermission,
  ROLE_PERMISSIONS,
  AgentRegistry,
  getAgentRegistry,
};
