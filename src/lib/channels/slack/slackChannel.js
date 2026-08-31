/**
 * Slack Channel Integration
 * 
 * Integrates with Slack via Slack API and Socket Mode.
 * Supports text, images, files, threads, reactions, and interactive messages.
 */

const { BaseChannel, ChannelStatus, MessageType } = require("../base/channel");

/**
 * Slack Channel
 */
class SlackChannel extends BaseChannel {
  constructor(options = {}) {
    super({
      ...options,
      type: "slack",
    });

    this.botToken = options.credentials.botToken || process.env.SLACK_BOT_TOKEN;
    this.appToken = options.credentials.appToken || process.env.SLACK_APP_TOKEN;
    this.signingSecret = options.credentials.signingSecret || process.env.SLACK_SIGNING_SECRET;
    this.baseUrl = "https://slack.com/api";
    
    this.client = null;
    this.socketMode = options.config.socketMode || false;
  }

  /**
   * Connect to Slack
   */
  async connect() {
    this.status = ChannelStatus.CONNECTING;
    this.emit("status", this.status);

    try {
      // Test connection
      const auth = await this._apiRequest("auth.test");
      console.log(`[Slack] Bot connected: @${auth.user}`);
      
      this.status = ChannelStatus.CONNECTED;
      this.emit("status", this.status);
      this.emitEvent("connected", { channelId: this.id, bot: auth });
      
      return true;
    } catch (error) {
      this.status = ChannelStatus.ERROR;
      this.emit("status", this.status);
      this.emitEvent("error", { error: error.message });
      
      console.error(`[Slack] Connection failed:`, error.message);
      return false;
    }
  }

  /**
   * Disconnect from Slack
   */
  async disconnect() {
    try {
      if (this.client) {
        await this.client.disconnect();
        this.client = null;
      }
      
      this.status = ChannelStatus.DISCONNECTED;
      this.emit("status", this.status);
      this.emitEvent("disconnected", { channelId: this.id });
      
      console.log(`[Slack] Disconnected`);
      return true;
    } catch (error) {
      console.error(`[Slack] Disconnect error:`, error.message);
      return false;
    }
  }

  /**
   * Send a message
   */
  async sendMessage(channel, content, options = {}) {
    if (this.status !== ChannelStatus.CONNECTED) {
      throw new Error("Slack channel not connected");
    }

    try {
      const payload = {
        channel,
        text: typeof content === "string" ? content : content.text,
      };

      if (options.thread_ts) {
        payload.thread_ts = options.thread_ts;
      }

      if (options.blocks) {
        payload.blocks = options.blocks;
      }

      if (options.attachments) {
        payload.attachments = options.attachments;
      }

      const response = await this._apiRequest("chat.postMessage", payload);
      
      this.stats.messagesSent++;
      this.stats.lastActivity = Date.now();
      
      return {
        success: true,
        messageId: response.ts,
        channel,
        threadTs: response.thread_ts,
      };
    } catch (error) {
      this.stats.errors++;
      throw error;
    }
  }

  /**
   * Reply to a message (in thread)
   */
  async replyToMessage(channel, threadTs, content, options = {}) {
    return this.sendMessage(channel, content, {
      ...options,
      thread_ts: threadTs,
    });
  }

  /**
   * React to a message
   */
  async reactToMessage(channel, timestamp, emoji) {
    try {
      await this._apiRequest("reactions.add", {
        channel,
        timestamp,
        name: emoji.replace(/:/g, ""),
      });
      
      return { success: true, timestamp, emoji };
    } catch (error) {
      this.stats.errors++;
      throw error;
    }
  }

  /**
   * Send direct message
   */
  async sendDirectMessage(userId, content, options = {}) {
    // Open DM channel
    const conversation = await this._apiRequest("conversations.open", {
      users: userId,
    });
    
    return this.sendMessage(conversation.channel.id, content, options);
  }

  /**
   * Send file
   */
  async sendFile(channel, file, filename, title = "") {
    try {
      const formData = new FormData();
      formData.append("channels", channel);
      formData.append("file", file, filename);
      formData.append("filename", filename);
      if (title) formData.append("title", title);
      
      const fetch = globalThis.fetch || (await import("undici")).fetch;
      const response = await fetch(`${this.baseUrl}/files.upload`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.botToken}`,
        },
        body: formData,
      });
      
      const result = await response.json();
      
      if (!result.ok) {
        throw new Error(result.error);
      }
      
      this.stats.messagesSent++;
      this.stats.lastActivity = Date.now();
      
      return {
        success: true,
        fileId: result.file?.id,
        channel,
      };
    } catch (error) {
      this.stats.errors++;
      throw error;
    }
  }

  /**
   * Update message
   */
  async updateMessage(channel, timestamp, content) {
    return this._apiRequest("chat.update", {
      channel,
      ts: timestamp,
      text: typeof content === "string" ? content : content.text,
    });
  }

  /**
   * Delete message
   */
  async deleteMessage(channel, timestamp) {
    return this._apiRequest("chat.delete", {
      channel,
      ts: timestamp,
    });
  }

  /**
   * Get channel info
   */
  async getChannelInfo() {
    const auth = await this._apiRequest("auth.test");
    return {
      id: this.id,
      type: "slack",
      name: this.name,
      bot: {
        userId: auth.user_id,
        username: auth.user,
        teamId: auth.team_id,
        team: auth.team,
      },
      status: this.status,
      stats: this.stats,
    };
  }

  /**
   * Handle incoming event
   */
  async handleEvent(event) {
    try {
      // Handle message events
      if (event.type === "message") {
        await this._processMessage(event);
      }

      // Handle reaction events
      if (event.type === "reaction_added" || event.type === "reaction_removed") {
        this.emitEvent("reaction", event);
      }

      // Handle app mentions
      if (event.type === "app_mention") {
        await this._processMessage(event);
      }

      return { success: true };
    } catch (error) {
      console.error(`[Slack] Event error:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Process incoming message
   */
  async _processMessage(event) {
    const processedMessage = {
      id: event.ts,
      channel: event.channel,
      threadTs: event.thread_ts,
      from: event.user,
      type: event.files ? MessageType.FILE : MessageType.TEXT,
      content: event.text,
      timestamp: parseFloat(event.ts) * 1000,
      channelType: event.channel_type,
      channel: "slack",
      raw: event,
    };

    await this.processIncomingMessage(processedMessage);
  }

  /**
   * Verify webhook signature
   */
  verifySignature(timestamp, signature, body) {
    const crypto = require("crypto");
    const hmac = crypto.createHmac("sha256", this.signingSecret);
    const sigBasestring = `v0:${timestamp}:${body}`;
    hmac.update(sigBasestring);
    const mySignature = `v0=${hmac.digest("hex")}`;
    return crypto.timingSafeEqual(Buffer.from(mySignature), Buffer.from(signature));
  }

  /**
   * Make API request
   */
  async _apiRequest(method, data = {}) {
    const fetch = globalThis.fetch || (await import("undici")).fetch;
    
    const url = `${this.baseUrl}/${method}`;
    const options = {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    };
    
    const response = await fetch(url, options);
    const result = await response.json();
    
    if (!result.ok) {
      throw new Error(result.error || `API request failed: ${method}`);
    }
    
    return result;
  }
}

module.exports = {
  SlackChannel,
};
