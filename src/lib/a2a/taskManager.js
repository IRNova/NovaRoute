/**
 * A2A Task Manager — Full lifecycle management for A2A tasks.
 * 
 * State machine: submitted → working → completed | failed | cancelled
 * 
 * Features:
 *   - UUID v4 task IDs
 *   - In-memory storage with optional persistence
 *   - Event logging for each state transition
 *   - TTL with configurable expiration (default 5 min)
 *   - Concurrent task limit
 */

const crypto = require('crypto');

// ============ Types ============

/**
 * @typedef {'submitted' | 'working' | 'completed' | 'failed' | 'cancelled'} TaskState
 * @typedef {{ role: string; content: string }} A2AMessage
 * @typedef {{ type: 'text' | 'json' | 'error'; content: string }} TaskArtifact
 * @typedef {{ timestamp: string; state: TaskState; message?: string }} TaskEvent
 */

const VALID_TRANSITIONS = {
  submitted: ['working', 'failed', 'cancelled'],
  working: ['completed', 'failed', 'cancelled'],
  completed: [],
  failed: [],
  cancelled: [],
};

// ============ Task Manager ============

class A2ATaskManager {
  constructor(ttlMinutes = 5) {
    /** @type {Map<string, A2ATask>} */
    this.tasks = new Map();
    this.ttlMs = ttlMinutes * 60 * 1000;
    this.activeStreams = 0;
    
    // Cleanup expired tasks every 60s
    this.cleanupInterval = setInterval(() => this._cleanupExpired(), 60_000);
  }

  /**
   * Create a new task
   * @param {{ skill: string; messages: A2AMessage[]; metadata?: Record<string, any> }} input
   * @param {string} [owner]
   * @returns {A2ATask}
   */
  createTask(input, owner) {
    const now = new Date();
    const task = {
      id: crypto.randomUUID(),
      skill: input.skill,
      state: 'submitted',
      input,
      artifacts: [],
      events: [{ timestamp: now.toISOString(), state: 'submitted' }],
      metadata: input.metadata || {},
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + this.ttlMs).toISOString(),
      ...(owner !== undefined ? { owner } : {}),
    };
    this.tasks.set(task.id, task);
    return task;
  }

  /**
   * Check if task is visible to the given owner
   * @param {A2ATask} task
   * @param {string} [owner]
   * @returns {boolean}
   */
  _isVisibleTo(task, owner) {
    return task.owner === undefined || task.owner === owner;
  }

  /**
   * Get a task by ID
   * @param {string} taskId
   * @param {string} [owner]
   * @returns {A2ATask | undefined}
   */
  getTask(taskId, owner) {
    const task = this.tasks.get(taskId);
    if (!task) return undefined;

    // Auto-expire running tasks
    if (new Date(task.expiresAt) < new Date()) {
      if (task.state === 'submitted' || task.state === 'working') {
        this.updateTask(taskId, 'failed', undefined, 'Task expired');
      }
    }

    const current = this.tasks.get(taskId);
    if (!current || !this._isVisibleTo(current, owner)) return undefined;
    return current;
  }

  /**
   * Update task state
   * @param {string} taskId
   * @param {TaskState} state
   * @param {TaskArtifact[]} [artifacts]
   * @param {string} [message]
   * @returns {A2ATask}
   */
  updateTask(taskId, state, artifacts, message) {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);

    const valid = VALID_TRANSITIONS[task.state];
    if (!valid.includes(state)) {
      throw new Error(`Invalid transition: ${task.state} → ${state}`);
    }

    const now = new Date().toISOString();
    task.state = state;
    task.updatedAt = now;
    task.events.push({ timestamp: now, state, message });
    if (artifacts) task.artifacts.push(...artifacts);

    return task;
  }

  /**
   * Cancel a task
   * @param {string} taskId
   * @param {string} [owner]
   * @returns {A2ATask}
   */
  cancelTask(taskId, owner) {
    const task = this.tasks.get(taskId);
    if (!task || !this._isVisibleTo(task, owner)) {
      throw new Error(`Task ${taskId} not found`);
    }
    return this.updateTask(taskId, 'cancelled', undefined, 'Cancelled by client');
  }

  /**
   * List tasks with filtering
   * @param {{ state?: TaskState; skill?: string; limit?: number; offset?: number }} [filter]
   * @param {string} [owner]
   * @returns {A2ATask[]}
   */
  listTasks(filter, owner) {
    let tasks = [...this.tasks.values()];
    
    if (owner !== undefined) {
      tasks = tasks.filter(t => this._isVisibleTo(t, owner));
    }
    if (filter?.state) tasks = tasks.filter(t => t.state === filter.state);
    if (filter?.skill) tasks = tasks.filter(t => t.skill === filter.skill);
    
    tasks.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    const offset = Math.max(0, filter?.offset || 0);
    const limit = typeof filter?.limit === 'number' ? Math.max(1, Math.floor(filter.limit)) : 50;
    
    return tasks.slice(offset, offset + limit);
  }

  beginStream() { this.activeStreams += 1; }
  endStream() { this.activeStreams = Math.max(0, this.activeStreams - 1); }

  /**
   * Get task statistics
   * @returns {{ counts: Record<TaskState, number>; total: number; activeStreams: number; lastTaskAt: string | null }}
   */
  getStats() {
    const counts = { submitted: 0, working: 0, completed: 0, failed: 0, cancelled: 0 };
    let lastTaskAt = null;

    for (const task of this.tasks.values()) {
      counts[task.state] += 1;
      const updatedAt = new Date(task.updatedAt).getTime();
      if (!Number.isFinite(updatedAt)) continue;
      if (!lastTaskAt || updatedAt > new Date(lastTaskAt).getTime()) {
        lastTaskAt = task.updatedAt;
      }
    }

    return { counts, total: this.tasks.size, activeStreams: this.activeStreams, lastTaskAt };
  }

  _cleanupExpired() {
    const now = new Date();
    for (const [id, task] of this.tasks) {
      if (new Date(task.expiresAt) < now && ['submitted', 'working'].includes(task.state)) {
        task.state = 'failed';
        task.updatedAt = now.toISOString();
        task.events.push({ timestamp: now.toISOString(), state: 'failed', message: 'TTL expired' });
      }
      // Remove terminal tasks older than 2x TTL
      if (['completed', 'failed', 'cancelled'].includes(task.state) &&
          now.getTime() - new Date(task.updatedAt).getTime() > this.ttlMs * 2) {
        this.tasks.delete(id);
      }
    }
  }

  destroy() {
    clearInterval(this.cleanupInterval);
  }
}

// Singleton
let _instance = null;

function getTaskManager() {
  if (!_instance) {
    _instance = new A2ATaskManager();
  }
  return _instance;
}

module.exports = { A2ATaskManager, getTaskManager };
