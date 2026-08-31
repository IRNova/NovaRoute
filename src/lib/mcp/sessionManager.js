/**
 * Session Manager - Multi-turn conversation support for NovaRoute
 * 
 * Manages conversation sessions, context, and history.
 * Inspired by Grok Bot's transcript system, adapted for NovaRoute.
 */

const crypto = require("crypto");
const { EventEmitter } = require("events");

/**
 * Conversation Session
 * Manages a single conversation session
 */
class ConversationSession {
  constructor(options = {}) {
    this.id = options.id || crypto.randomUUID();
    this.agentId = options.agentId || "default";
    this.provider = options.provider;
    this.model = options.model;
    this.createdAt = Date.now();
    this.updatedAt = Date.now();
    this.messages = [];
    this.metadata = options.metadata || {};
    this.maxMessages = options.maxMessages || 100;
    this.maxTokens = options.maxTokens || 100000;
  }

  /**
   * Add a user message
   */
  addUserMessage(content, options = {}) {
    const message = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      timestamp: Date.now(),
      ...options,
    };
    
    this.messages.push(message);
    this.updatedAt = Date.now();
    
    // Trim if too many messages
    if (this.messages.length > this.maxMessages) {
      this.messages = this.messages.slice(-this.maxMessages);
    }
    
    return message;
  }

  /**
   * Add an assistant message
   */
  addAssistantMessage(content, options = {}) {
    const message = {
      id: crypto.randomUUID(),
      role: "assistant",
      content,
      timestamp: Date.now(),
      ...options,
    };
    
    this.messages.push(message);
    this.updatedAt = Date.now();
    
    // Trim if too many messages
    if (this.messages.length > this.maxMessages) {
      this.messages = this.messages.slice(-this.maxMessages);
    }
    
    return message;
  }

  /**
   * Add a system message
   */
  addSystemMessage(content, options = {}) {
    const message = {
      id: crypto.randomUUID(),
      role: "system",
      content,
      timestamp: Date.now(),
      ...options,
    };
    
    this.messages.push(message);
    this.updatedAt = Date.now();
    
    return message;
  }

  /**
   * Get messages for LLM consumption
   */
  getMessagesForLLM(options = {}) {
    const { includeSystem = true, limit } = options;
    
    let messages = this.messages;
    
    // Filter out system messages if not wanted
    if (!includeSystem) {
      messages = messages.filter(m => m.role !== "system");
    }
    
    // Apply limit
    if (limit && messages.length > limit) {
      messages = messages.slice(-limit);
    }
    
    return messages.map(m => ({
      role: m.role,
      content: m.content,
    }));
  }

  /**
   * Get conversation context (last N messages)
   */
  getContext(messageCount = 10) {
    return this.messages.slice(-messageCount);
  }

  /**
   * Get total token count (estimated)
   */
  getEstimatedTokens() {
    // Rough estimation: 1 token ≈ 4 characters
    let totalChars = 0;
    for (const msg of this.messages) {
      totalChars += (msg.content || "").length;
    }
    return Math.ceil(totalChars / 4);
  }

  /**
   * Clear conversation history
   */
  clear() {
    this.messages = [];
    this.updatedAt = Date.now();
  }

  /**
   * Export session as JSON
   */
  toJSON() {
    return {
      id: this.id,
      agentId: this.agentId,
      provider: this.provider,
      model: this.model,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      messages: this.messages,
      metadata: this.metadata,
    };
  }

  /**
   * Import session from JSON
   */
  static fromJSON(data) {
    const session = new ConversationSession({
      id: data.id,
      agentId: data.agentId,
      provider: data.provider,
      model: data.model,
      metadata: data.metadata,
    });
    
    session.createdAt = data.createdAt;
    session.updatedAt = data.updatedAt;
    session.messages = data.messages || [];
    
    return session;
  }
}

/**
 * Session Manager
 * Manages multiple conversation sessions
 */
class SessionManager extends EventEmitter {
  constructor(options = {}) {
    super();
    this.sessions = new Map();
    this.dataDir = options.dataDir || process.env.DATA_DIR || "~/.novaroute";
    this.maxSessions = options.maxSessions || 100;
    this.sessionTimeout = options.sessionTimeout || 3600000; // 1 hour
    
    // Load persisted sessions
    this._loadSessions();
  }

  /**
   * Create a new session
   */
  createSession(options = {}) {
    const session = new ConversationSession(options);
    this.sessions.set(session.id, session);
    
    // Emit event
    this.emit("session:created", session);
    
    // Trim old sessions
    this._trimSessions();
    
    return session;
  }

  /**
   * Get a session by ID
   */
  getSession(sessionId) {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Get or create a session
   */
  getOrCreateSession(sessionId, options = {}) {
    let session = this.getSession(sessionId);
    
    if (!session) {
      session = this.createSession({ id: sessionId, ...options });
    }
    
    return session;
  }

  /**
   * List all sessions
   */
  listSessions(options = {}) {
    const { agentId, limit = 50, offset = 0 } = options;
    
    let sessions = Array.from(this.sessions.values());
    
    // Filter by agent
    if (agentId) {
      sessions = sessions.filter(s => s.agentId === agentId);
    }
    
    // Sort by updated time (newest first)
    sessions.sort((a, b) => b.updatedAt - a.updatedAt);
    
    // Apply pagination
    return sessions.slice(offset, offset + limit);
  }

  /**
   * Delete a session
   */
  deleteSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }
    
    this.sessions.delete(sessionId);
    this.emit("session:deleted", { sessionId });
    
    return true;
  }

  /**
   * Clear all sessions for an agent
   */
  clearAgentSessions(agentId) {
    let count = 0;
    
    for (const [id, session] of this.sessions) {
      if (session.agentId === agentId) {
        this.sessions.delete(id);
        count++;
      }
    }
    
    if (count > 0) {
      this.emit("agent:sessions-cleared", { agentId, count });
    }
    
    return count;
  }

  /**
   * Get session statistics
   */
  getStats() {
    const sessions = Array.from(this.sessions.values());
    
    const totalMessages = sessions.reduce((sum, s) => sum + s.messages.length, 0);
    const totalTokens = sessions.reduce((sum, s) => sum + s.getEstimatedTokens(), 0);
    
    const byAgent = {};
    for (const session of sessions) {
      byAgent[session.agentId] = (byAgent[session.agentId] || 0) + 1;
    }
    
    return {
      totalSessions: sessions.length,
      totalMessages,
      totalTokens,
      byAgent,
      oldestSession: sessions.length > 0
        ? Math.min(...sessions.map(s => s.createdAt))
        : null,
      newestSession: sessions.length > 0
        ? Math.max(...sessions.map(s => s.updatedAt))
        : null,
    };
  }

  /**
   * Export all sessions
   */
  exportSessions() {
    return Array.from(this.sessions.values()).map(s => s.toJSON());
  }

  /**
   * Import sessions
   */
  importSessions(data) {
    let count = 0;
    
    for (const sessionData of data) {
      try {
        const session = ConversationSession.fromJSON(sessionData);
        this.sessions.set(session.id, session);
        count++;
      } catch (error) {
        console.error("[SessionManager] Failed to import session:", error.message);
      }
    }
    
    this.emit("sessions:imported", { count });
    
    return count;
  }

  /**
   * Trim old sessions
   */
  _trimSessions() {
    if (this.sessions.size <= this.maxSessions) {
      return;
    }
    
    const sessions = Array.from(this.sessions.values());
    sessions.sort((a, b) => a.updatedAt - b.updatedAt);
    
    const toRemove = sessions.slice(0, sessions.length - this.maxSessions);
    
    for (const session of toRemove) {
      this.sessions.delete(session.id);
    }
    
    if (toRemove.length > 0) {
      this.emit("sessions:trimmed", { count: toRemove.length });
    }
  }

  /**
   * Load sessions from disk
   */
  _loadSessions() {
    try {
      const fs = require("fs");
      const path = require("path");
      
      const sessionsPath = path.join(this.dataDir, "sessions.json");
      
      if (fs.existsSync(sessionsPath)) {
        const data = JSON.parse(fs.readFileSync(sessionsPath, "utf8"));
        this.importSessions(data);
      }
    } catch (error) {
      console.error("[SessionManager] Failed to load sessions:", error.message);
    }
  }

  /**
   * Save sessions to disk
   */
  saveSessions() {
    try {
      const fs = require("fs");
      const path = require("path");
      
      const sessionsDir = path.dirname(path.join(this.dataDir, "sessions.json"));
      if (!fs.existsSync(sessionsDir)) {
        fs.mkdirSync(sessionsDir, { recursive: true });
      }
      
      const sessionsPath = path.join(this.dataDir, "sessions.json");
      const data = this.exportSessions();
      
      fs.writeFileSync(sessionsPath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error("[SessionManager] Failed to save sessions:", error.message);
    }
  }
}

// Singleton instance
let managerInstance = null;

/**
 * Get or create Session Manager instance
 */
function getSessionManager(options = {}) {
  if (!managerInstance) {
    managerInstance = new SessionManager(options);
  }
  return managerInstance;
}

module.exports = {
  ConversationSession,
  SessionManager,
  getSessionManager,
};
