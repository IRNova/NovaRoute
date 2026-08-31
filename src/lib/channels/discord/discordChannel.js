/**
 * Discord Channel Integration
 * 
 * Integrates with Discord via Discord.js.
 * Supports text, images, files, threads, reactions, embeds, and slash commands.
 */

const { BaseChannel, ChannelStatus, MessageType } = require("../base/channel");

/**
 * Discord Channel
 */
class DiscordChannel extends BaseChannel {
  constructor(options = {}) {
    super({
      ...options,
      type: "discord",
    });

    this.botToken = options.credentials.botToken || process.env.DISCORD_BOT_TOKEN;
    this.applicationId = options.credentials.applicationId || process.env.DISCORD_APPLICATION_ID;
    this.guildId = options.config.guildId || process.env.DISCORD_GUILD_ID;
    this.baseUrl = "https://discord.com/api/v10";
    
    this.client = null;
  }

  /**
   * Connect to Discord
   */
  async connect() {
    this.status = ChannelStatus.CONNECTING;
    this.emit("status", this.status);

    try {
      // Test connection
      const me = await this._apiRequest("users/@me");
      console.log(`[Discord] Bot connected: ${me.username}#${me.discriminator}`);
      
      this.status = ChannelStatus.CONNECTED;
      this.emit("status", this.status);
      this.emitEvent("connected", { channelId: this.id, bot: me });
      
      return true;
    } catch (error) {
      this.status = ChannelStatus.ERROR;
      this.emit("status", this.status);
      this.emitEvent("error", { error: error.message });
      
      console.error(`[Discord] Connection failed:`, error.message);
      return false;
    }
  }

  /**
   * Disconnect from Discord
   */
  async disconnect() {
    try {
      if (this.client) {
        await this.client.destroy();
        this.client = null;
      }
      
      this.status = ChannelStatus.DISCONNECTED;
      this.emit("status", this.status);
      this.emitEvent("disconnected", { channelId: this.id });
      
      console.log(`[Discord] Disconnected`);
      return true;
    } catch (error) {
      console.error(`[Discord] Disconnect error:`, error.message);
      return false;
    }
  }

  /**
   * Send a message
   */
  async sendMessage(channelId, content, options = {}) {
    if (this.status !== ChannelStatus.CONNECTED) {
      throw new Error("Discord channel not connected");
    }

    try {
      const payload = {
        content: typeof content === "string" ? content : content.text,
      };

      if (options.embeds) {
        payload.embeds = options.embeds;
      }

      if (options.components) {
        payload.components = options.components;
      }

      if (options.files) {
        payload.files = options.files;
      }

      const response = await this._apiRequest("POST", `/channels/${channelId}/messages`, payload);
      
      this.stats.messagesSent++;
      this.stats.lastActivity = Date.now();
      
      return {
        success: true,
        messageId: response.id,
        channelId,
      };
    } catch (error) {
      this.stats.errors++;
      throw error;
    }
  }

  /**
   * Reply to a message (in thread)
   */
  async replyToMessage(channelId, messageId, content, options = {}) {
    return this.sendMessage(channelId, content, {
      ...options,
      message_reference: {
        message_id: messageId,
        channel_id: channelId,
      },
    });
  }

  /**
   * React to a message
   */
  async reactToMessage(channelId, messageId, emoji) {
    try {
      await this._apiRequest("PUT", `/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}/@me`);
      
      return { success: true, messageId, emoji };
    } catch (error) {
      this.stats.errors++;
      throw error;
    }
  }

  /**
   * Send embed
   */
  async sendEmbed(channelId, embed, content = "") {
    return this.sendMessage(channelId, content, { embeds: [embed] });
  }

  /**
   * Send file
   */
  async sendFile(channelId, file, filename, content = "") {
    return this.sendMessage(channelId, content, {
      files: [{ attachment: file, name: filename }],
    });
  }

  /**
   * Create thread
   */
  async createThread(channelId, name, message = "") {
    const response = await this._apiRequest("POST", `/channels/${channelId}/threads`, {
      name,
      auto_archive_duration: 60,
    });

    if (message) {
      await this.sendMessage(response.id, message);
    }

    return {
      success: true,
      threadId: response.id,
      name,
    };
  }

  /**
   * Send to thread
   */
  async sendToThread(threadId, content, options = {}) {
    return this.sendMessage(threadId, content, options);
  }

  /**
   * Update message
   */
  async updateMessage(channelId, messageId, content) {
    return this._apiRequest("PATCH", `/channels/${channelId}/messages/${messageId}`, {
      content: typeof content === "string" ? content : content.text,
    });
  }

  /**
   * Delete message
   */
  async deleteMessage(channelId, messageId) {
    return this._apiRequest("DELETE", `/channels/${channelId}/messages/${messageId}`);
  }

  /**
   * Get channel info
   */
  async getChannelInfo() {
    const me = await this._apiRequest("GET", "/users/@me");
    return {
      id: this.id,
      type: "discord",
      name: this.name,
      bot: {
        id: me.id,
        username: me.username,
        discriminator: me.discriminator,
        avatar: me.avatar,
      },
      status: this.status,
      stats: this.stats,
    };
  }

  /**
   * Handle incoming interaction
   */
  async handleInteraction(interaction) {
    try {
      // Handle slash commands
      if (interaction.type === 2) { // APPLICATION_COMMAND
        await this._processCommand(interaction);
      }

      // Handle button clicks
      if (interaction.type === 3) { // MESSAGE_COMPONENT
        await this._processComponent(interaction);
      }

      // Handle modal submissions
      if (interaction.type === 5) { // MODAL_SUBMIT
        await this._processModal(interaction);
      }

      return { success: true };
    } catch (error) {
      console.error(`[Discord] Interaction error:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Handle message create event
   */
  async handleMessageCreate(event) {
    await this._processMessage(event);
  }

  /**
   * Process incoming message
   */
  async _processMessage(event) {
    const processedMessage = {
      id: event.id,
      channelId: event.channel_id,
      guildId: event.guild_id,
      from: event.author?.id,
      sender: event.author ? {
        id: event.author.id,
        username: event.author.username,
        discriminator: event.author.discriminator,
        avatar: event.author.avatar,
        bot: event.author.bot,
      } : null,
      type: this._getMessageType(event),
      content: this._extractContent(event),
      timestamp: new Date(event.timestamp).getTime(),
      channel: "discord",
      raw: event,
    };

    await this.processIncomingMessage(processedMessage);
  }

  /**
   * Process slash command
   */
  async _processCommand(interaction) {
    this.emitEvent("command", {
      id: interaction.id,
      name: interaction.data?.name,
      options: interaction.data?.options,
      user: interaction.member?.user || interaction.user,
      channel: interaction.channel_id,
      guild: interaction.guild_id,
    });
  }

  /**
   * Process component interaction
   */
  async _processComponent(interaction) {
    this.emitEvent("component", {
      id: interaction.id,
      customId: interaction.data?.custom_id,
      type: interaction.data?.component_type,
      user: interaction.member?.user || interaction.user,
      message: interaction.message,
    });
  }

  /**
   * Process modal submission
   */
  async _processModal(interaction) {
    this.emitEvent("modal", {
      id: interaction.id,
      customId: interaction.data?.custom_id,
      components: interaction.data?.components,
      user: interaction.member?.user || interaction.user,
    });
  }

  /**
   * Respond to interaction
   */
  async respondInteraction(interactionId, response) {
    return this._apiRequest("POST", `/interactions/${interactionId}/callback`, {
      type: response.type || 4, // CHANNEL_MESSAGE_WITH_SOURCE
      data: response.data,
    });
  }

  /**
   * Get message type
   */
  _getMessageType(event) {
    if (event.attachments?.length > 0) {
      const attachment = event.attachments[0];
      if (attachment.content_type?.startsWith("image/")) return MessageType.IMAGE;
      if (attachment.content_type?.startsWith("video/")) return MessageType.VIDEO;
      if (attachment.content_type?.startsWith("audio/")) return MessageType.AUDIO;
      return MessageType.FILE;
    }
    return MessageType.TEXT;
  }

  /**
   * Extract content from message
   */
  _extractContent(event) {
    if (event.content) return event.content;
    if (event.attachments?.length > 0) {
      return {
        url: event.attachments[0].url,
        filename: event.attachments[0].filename,
      };
    }
    return null;
  }

  /**
   * Make API request
   */
  async _apiRequest(method, endpoint, data = null) {
    const fetch = globalThis.fetch || (await import("undici")).fetch;
    
    const url = `${this.baseUrl}${endpoint}`;
    const options = {
      method,
      headers: {
        "Authorization": `Bot ${this.botToken}`,
        "Content-Type": "application/json",
      },
    };
    
    if (data && (method === "POST" || method === "PUT" || method === "PATCH")) {
      options.body = JSON.stringify(data);
    }
    
    const response = await fetch(url, options);
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || `API request failed: ${response.status}`);
    }
    
    // Some endpoints return 204 No Content
    if (response.status === 204) {
      return { success: true };
    }
    
    return await response.json();
  }
}

module.exports = {
  DiscordChannel,
};
