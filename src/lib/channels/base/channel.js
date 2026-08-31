/**
 * Base Channel Class
 * 
 * Abstract base class for all messaging channel integrations.
 * Provides common functionality for message handling, authentication, and events.
 */

const { EventEmitter } = require("events");
const crypto = require("crypto");

/**
 * Channel Status
 */
const ChannelStatus = {
  DISCONNECTED: "disconnected",
  CONNECTING: "connecting",
  CONNECTED: "connected",
  ERROR: "error",
};

/**
 * Message Types
 */
const MessageType = {
  TEXT: "text",
  IMAGE: "image",
  VIDEO: "video",
  AUDIO: "audio",
  FILE: "file",
  LOCATION: "location",
  CONTACT: "contact",
  STICKER: "sticker",
  REACTION: "reaction",
};

/**
 * Base Channel Class
 */
class BaseChannel extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.id = options.id || crypto.randomUUID();
    this.name = options.name || "unknown";
    this.type = options.type || "base";
    this.status = ChannelStatus.DISCONNECTED;
    
    this.config = options.config || {};
    this.credentials = options.credentials || {};
    
    this.messageHandlers = new Map();
    this.eventHandlers = new Map();
    
    this.stats = {
      messagesSent: 0,
      messagesReceived: 0,
      errors: 0,
      lastActivity: null,
    };
  }

  /**
   * Connect to the channel
   */
  async connect() {
    throw new Error("connect() must be implemented by subclass");
  }

  /**
   * Disconnect from the channel
   */
  async disconnect() {
    throw new Error("disconnect() must be implemented by subclass");
  }

  /**
   * Send a message
   */
  async sendMessage(recipient, content, options = {}) {
    throw new Error("sendMessage() must be implemented by subclass");
  }

  /**
   * Reply to a message
   */
  async replyToMessage(messageId, content, options = {}) {
    throw new Error("replyToMessage() must be implemented by subclass");
  }

  /**
   * React to a message
   */
  async reactToMessage(messageId, emoji) {
    throw new Error("reactToMessage() must be implemented by subclass");
  }

  /**
   * Get channel info
   */
  async getChannelInfo() {
    throw new Error("getChannelInfo() must be implemented by subclass");
  }

  /**
   * Register message handler
   */
  onMessage(handler) {
    this.messageHandlers.set("default", handler);
  }

  /**
   * Register event handler
   */
  onEvent(eventName, handler) {
    if (!this.eventHandlers.has(eventName)) {
      this.eventHandlers.set(eventName, []);
    }
    this.eventHandlers.get(eventName).push(handler);
  }

  /**
   * Emit event to handlers
   */
  emitEvent(eventName, data) {
    const handlers = this.eventHandlers.get(eventName) || [];
    for (const handler of handlers) {
      try {
        handler(data);
      } catch (error) {
        console.error(`[Channel:${this.name}] Event handler error:`, error);
      }
    }
  }

  /**
   * Process incoming message
   */
  async processIncomingMessage(message) {
    this.stats.messagesReceived++;
    this.stats.lastActivity = Date.now();

    const handler = this.messageHandlers.get("default");
    if (handler) {
      try {
        await handler(message);
      } catch (error) {
        console.error(`[Channel:${this.name}] Message handler error:`, error);
        this.stats.errors++;
      }
    }

    this.emit("message", message);
    this.emitEvent("message", message);
  }

  /**
   * Get channel status
   */
  getStatus() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      status: this.status,
      stats: this.stats,
    };
  }

  /**
   * Get health check
   */
  async healthCheck() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      status: this.status,
      connected: this.status === ChannelStatus.CONNECTED,
      stats: this.stats,
    };
  }
}

module.exports = {
  BaseChannel,
  ChannelStatus,
  MessageType,
};
