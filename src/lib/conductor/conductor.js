/**
 * Conductor System — Fleet orchestration & management
 * 
 * Manages agent fleets, coordinates multi-agent tasks,
 * monitors agent health, and handles agent lifecycle.
 */

const { EventEmitter } = require('events');
const crypto = require('crypto');

// ============ Agent States ============

const AgentState = {
  IDLE: 'idle',
  BUSY: 'busy',
  ERROR: 'error',
  OFFLINE: 'offline',
  STARTING: 'starting',
  STOPPING: 'stopping',
};

// ============ Agent Registry ============

class AgentRegistry extends EventEmitter {
  constructor() {
    super();
    /** @type {Map<string, AgentInfo>} */
    this.agents = new Map();
    this.healthCheckInterval = null;
  }

  /**
   * Register a new agent
   */
  register(agentConfig) {
    const agent = {
      id: agentConfig.id || crypto.randomUUID(),
      name: agentConfig.name || 'Unnamed Agent',
      type: agentConfig.type || 'general',
      state: AgentState.STARTING,
      capabilities: agentConfig.capabilities || [],
      metadata: agentConfig.metadata || {},
      registeredAt: new Date().toISOString(),
      lastHeartbeat: new Date().toISOString(),
      tasksCompleted: 0,
      tasksFailed: 0,
      avgResponseTime: 0,
    };

    this.agents.set(agent.id, agent);
    this.emit('agent:registered', agent);
    return agent;
  }

  /**
   * Update agent state
   */
  updateState(agentId, state, metadata = {}) {
    const agent = this.agents.get(agentId);
    if (!agent) throw new Error(`Agent not found: ${agentId}`);

    const prevState = agent.state;
    agent.state = state;
    Object.assign(agent.metadata, metadata);
    agent.lastHeartbeat = new Date().toISOString();

    this.emit('agent:state-changed', { agentId, prevState, newState: state });
    return agent;
  }

  /**
   * Record heartbeat
   */
  heartbeat(agentId) {
    const agent = this.agents.get(agentId);
    if (!agent) return;
    agent.lastHeartbeat = new Date().toISOString();
    if (agent.state === AgentState.OFFLINE) {
      agent.state = AgentState.IDLE;
      this.emit('agent:reconnected', agent);
    }
  }

  /**
   * Record task completion
   */
  recordTask(agentId, success, responseTimeMs) {
    const agent = this.agents.get(agentId);
    if (!agent) return;

    if (success) {
      agent.tasksCompleted += 1;
    } else {
      agent.tasksFailed += 1;
    }

    // Running average
    const total = agent.tasksCompleted + agent.tasksFailed;
    agent.avgResponseTime = ((agent.avgResponseTime * (total - 1)) + responseTimeMs) / total;
  }

  /**
   * Unregister an agent
   */
  unregister(agentId) {
    const agent = this.agents.get(agentId);
    if (!agent) return false;
    this.agents.delete(agentId);
    this.emit('agent:unregistered', agent);
    return true;
  }

  /**
   * Get agent by ID
   */
  get(agentId) {
    return this.agents.get(agentId);
  }

  /**
   * Find agents by capability
   */
  findByCapability(capability) {
    return [...this.agents.values()].filter(
      a => a.capabilities.includes(capability) && a.state !== AgentState.OFFLINE
    );
  }

  /**
   * Find best agent for a task
   */
  findBest(capability) {
    const candidates = this.findByCapability(capability);
    if (candidates.length === 0) return null;

    // Score: prefer idle agents, then lowest avg response time
    return candidates.sort((a, b) => {
      if (a.state === AgentState.IDLE && b.state !== AgentState.IDLE) return -1;
      if (b.state === AgentState.IDLE && a.state !== AgentState.IDLE) return 1;
      return a.avgResponseTime - b.avgResponseTime;
    })[0];
  }

  /**
   * Get all agents
   */
  getAll(filter = {}) {
    let agents = [...this.agents.values()];
    if (filter.state) agents = agents.filter(a => a.state === filter.state);
    if (filter.type) agents = agents.filter(a => a.type === filter.type);
    return agents;
  }

  /**
   * Get fleet stats
   */
  stats() {
    const agents = [...this.agents.values()];
    return {
      total: agents.length,
      byState: Object.values(AgentState).reduce((acc, state) => {
        acc[state] = agents.filter(a => a.state === state).length;
        return acc;
      }, {}),
      totalTasksCompleted: agents.reduce((s, a) => s + a.tasksCompleted, 0),
      totalTasksFailed: agents.reduce((s, a) => s + a.tasksFailed, 0),
      avgResponseTime: agents.length > 0
        ? agents.reduce((s, a) => s + a.avgResponseTime, 0) / agents.length
        : 0,
    };
  }

  /**
   * Start health check monitoring
   */
  startHealthCheck(intervalMs = 30000) {
    this.healthCheckInterval = setInterval(() => {
      const now = Date.now();
      for (const [id, agent] of this.agents) {
        const lastBeat = new Date(agent.lastHeartbeat).getTime();
        if (now - lastBeat > intervalMs * 3 && agent.state !== AgentState.OFFLINE) {
          agent.state = AgentState.OFFLINE;
          this.emit('agent:offline', agent);
        }
      }
    }, intervalMs);
  }

  stopHealthCheck() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }
}

// ============ Task Dispatcher ============

class TaskDispatcher {
  constructor(registry) {
    this.registry = registry;
    this.taskQueue = [];
    this.activeTasks = new Map();
  }

  /**
   * Dispatch a task to the best available agent
   */
  async dispatch(task) {
    const agent = this.registry.findBest(task.requiredCapability);
    if (!agent) {
      throw new Error(`No available agent for capability: ${task.requiredCapability}`);
    }

    const taskId = crypto.randomUUID();
    const dispatch = {
      id: taskId,
      task,
      agentId: agent.id,
      state: 'dispatched',
      dispatchedAt: new Date().toISOString(),
    };

    this.activeTasks.set(taskId, dispatch);
    this.registry.updateState(agent.id, AgentState.BUSY);

    return dispatch;
  }

  /**
   * Complete a task
   */
  complete(taskId, success, result, responseTimeMs) {
    const dispatch = this.activeTasks.get(taskId);
    if (!dispatch) throw new Error(`Task not found: ${taskId}`);

    dispatch.state = success ? 'completed' : 'failed';
    dispatch.result = result;
    dispatch.completedAt = new Date().toISOString();

    this.registry.recordTask(dispatch.agentId, success, responseTimeMs);
    this.registry.updateState(dispatch.agentId, AgentState.IDLE);
    this.activeTasks.delete(taskId);

    return dispatch;
  }

  /**
   * Get active tasks
   */
  getActive() {
    return [...this.activeTasks.values()];
  }
}

// ============ Conductor ============

class Conductor extends EventEmitter {
  constructor() {
    super();
    this.registry = new AgentRegistry();
    this.dispatcher = new TaskDispatcher(this.registry);
    this.bootTime = Date.now();
  }

  /**
   * Boot the conductor
   */
  async boot(config = {}) {
    console.log('[Conductor] Booting...');
    this.registry.startHealthCheck(config.healthCheckInterval || 30000);
    this.emit('booted');
    console.log('[Conductor] Ready');
  }

  /**
   * Shutdown the conductor
   */
  async shutdown() {
    console.log('[Conductor] Shutting down...');
    this.registry.stopHealthCheck();
    this.emit('shutdown');
    console.log('[Conductor] Stopped');
  }

  /**
   * Get system status
   */
  status() {
    const uptime = Date.now() - this.bootTime;
    return {
      status: 'running',
      uptime,
      uptimeFormatted: this._formatUptime(uptime),
      fleet: this.registry.stats(),
      activeTasks: this.dispatcher.getActive().length,
      bootTime: new Date(this.bootTime).toISOString(),
    };
  }

  _formatUptime(ms) {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    const d = Math.floor(h / 24);
    if (d > 0) return `${d}d ${h % 24}h ${m % 60}m`;
    if (h > 0) return `${h}h ${m % 60}m`;
    return `${m}m ${s % 60}s`;
  }
}

// Singleton
let _instance = null;

function getConductor() {
  if (!_instance) _instance = new Conductor();
  return _instance;
}

module.exports = {
  AgentState,
  AgentRegistry,
  TaskDispatcher,
  Conductor,
  getConductor,
};
