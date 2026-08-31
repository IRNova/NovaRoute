/**
 * Channel Manager
 * 
 * Manages all messaging channel integrations.
 * Provides unified interface for connecting, sending, and receiving messages.
 */

const { EventEmitter } = require("events");
const { WhatsAppChannel } = require("./whatsapp/whatsappChannel");
const { TelegramChannel } = require("./telegram/telegramChannel");
const { SlackChannel } = require("./slack/slackChannel");
const { DiscordChannel } = require("./discord/discordChannel");
const { WebhookChannel } = require("./webhook/webhookChannel");

/**
 * Channel Types
 */
const ChannelTypes = {
  WHATSAPP: "whatsapp",
  TELEGRAM: "telegram",
  SLACK: "slack",
  DISCORD: "discord",
  // Anything else that speaks HTTP. See webhook/webhookChannel.js.
  WEBHOOK: "webhook",
};

/**
 * Channel Manager
 */
class ChannelManager extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.channels = new Map();
    this.config = options.config || {};
    this.messageHandlers = new Map();
    
    // Auto-connect on start
    this.autoConnect = options.autoConnect || false;
  }

  /**
   * Create a channel instance
   */
  createChannel(type, options = {}) {
    let channel;
    
    switch (type) {
      case ChannelTypes.WHATSAPP:
        channel = new WhatsAppChannel(options);
        break;
      case ChannelTypes.TELEGRAM:
        channel = new TelegramChannel(options);
        break;
      case ChannelTypes.SLACK:
        channel = new SlackChannel(options);
        break;
      case ChannelTypes.DISCORD:
        channel = new DiscordChannel(options);
        break;
      case ChannelTypes.WEBHOOK:
        channel = new WebhookChannel(options);
        break;
      default:
        throw new Error(`Unknown channel type: ${type}`);
    }
    
    this.channels.set(channel.id, channel);
    
    // Setup message forwarding
    channel.on("message", (message) => {
      this.emit("message", { channelId: channel.id, channelType: type, message });
      this._handleMessage(channel.id, type, message);
    });
    
    // Setup status forwarding
    channel.on("status", (status) => {
      this.emit("status", { channelId: channel.id, channelType: type, status });
    });
    
    // Setup event forwarding
    channel.onEvent("*", (data) => {
      this.emit("channel_event", { channelId: channel.id, channelType: type, data });
    });
    
    return channel;
  }

  /**
   * Connect a channel
   */
  async connectChannel(channelId) {
    const channel = this.channels.get(channelId);
    if (!channel) {
      throw new Error(`Channel not found: ${channelId}`);
    }
    
    return await channel.connect();
  }

  /**
   * Disconnect a channel
   */
  async disconnectChannel(channelId) {
    const channel = this.channels.get(channelId);
    if (!channel) {
      throw new Error(`Channel not found: ${channelId}`);
    }
    
    return await channel.disconnect();
  }

  /**
   * Connect all channels
   */
  async connectAll() {
    const results = [];
    
    for (const [channelId, channel] of this.channels) {
      try {
        await channel.connect();
        results.push({ channelId, success: true });
      } catch (error) {
        results.push({ channelId, success: false, error: error.message });
      }
    }
    
    return results;
  }

  /**
   * Disconnect all channels
   */
  async disconnectAll() {
    const results = [];
    
    for (const [channelId, channel] of this.channels) {
      try {
        await channel.disconnect();
        results.push({ channelId, success: true });
      } catch (error) {
        results.push({ channelId, success: false, error: error.message });
      }
    }
    
    return results;
  }

  /**
   * Send message to a channel
   */
  async sendMessage(channelId, recipient, content, options = {}) {
    const channel = this.channels.get(channelId);
    if (!channel) {
      throw new Error(`Channel not found: ${channelId}`);
    }
    
    return await channel.sendMessage(recipient, content, options);
  }

  /**
   * Broadcast message to all connected channels
   */
  async broadcastMessage(content, options = {}) {
    const results = [];
    
    for (const [channelId, channel] of this.channels) {
      if (channel.status === "connected") {
        try {
          const result = await channel.sendMessage(options.recipient || "default", content, options);
          results.push({ channelId, success: true, result });
        } catch (error) {
          results.push({ channelId, success: false, error: error.message });
        }
      }
    }
    
    return results;
  }

  /**
   * Get all channels status
   */
  getStatus() {
    const status = {};
    
    for (const [channelId, channel] of this.channels) {
      status[channelId] = channel.getStatus();
    }
    
    return status;
  }

  /**
   * Get connected channels
   */
  getConnectedChannels() {
    const connected = [];
    
    for (const [channelId, channel] of this.channels) {
      if (channel.status === "connected") {
        connected.push(channelId);
      }
    }
    
    return connected;
  }

  /**
   * Get channel by ID
   */
  getChannel(channelId) {
    return this.channels.get(channelId);
  }

  /**
   * Get channels by type
   */
  getChannelsByType(type) {
    const channels = [];
    
    for (const [channelId, channel] of this.channels) {
      if (channel.type === type) {
        channels.push(channel);
      }
    }
    
    return channels;
  }

  /**
   * Register message handler
   */
  onMessage(handler) {
    this.messageHandlers.set("default", handler);
  }

  /**
   * Register channel-specific message handler
   */
  onChannelMessage(channelId, handler) {
    this.messageHandlers.set(channelId, handler);
  }

  /**
   * Handle incoming message
   */
  _handleMessage(channelId, channelType, message) {
    // Call default handler
    const defaultHandler = this.messageHandlers.get("default");
    if (defaultHandler) {
      try {
        defaultHandler({ channelId, channelType, message });
      } catch (error) {
        console.error(`[ChannelManager] Default handler error:`, error);
      }
    }
    
    // Call channel-specific handler
    const channelHandler = this.messageHandlers.get(channelId);
    if (channelHandler) {
      try {
        channelHandler(message);
      } catch (error) {
        console.error(`[ChannelManager] Channel handler error:`, error);
      }
    }
  }

  /**
   * Health check for all channels
   */
  async healthCheck() {
    const results = {};
    
    for (const [channelId, channel] of this.channels) {
      results[channelId] = await channel.healthCheck();
    }
    
    return results;
  }
}

// Singleton instance
let managerInstance = null;

/**
 * Get or create Channel Manager instance
 */
function getChannelManager(options = {}) {
  if (!managerInstance) {
    managerInstance = new ChannelManager(options);
  }
  return managerInstance;
}

module.exports = {
  ChannelManager,
  ChannelTypes,
  getChannelManager,
};
