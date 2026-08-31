/**
 * WhatsApp Channel Integration
 * 
 * Integrates with WhatsApp via WhatsApp Business API or unofficial libraries.
 * Supports text, images, videos, audio, documents, and reactions.
 */

const { BaseChannel, ChannelStatus, MessageType } = require("../base/channel");

/**
 * WhatsApp Channel
 */
class WhatsAppChannel extends BaseChannel {
  constructor(options = {}) {
    super({
      ...options,
      type: "whatsapp",
    });

    this.phoneNumberId = options.config.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;
    this.accessToken = options.credentials.accessToken || process.env.WHATSAPP_ACCESS_TOKEN;
    this.webhookVerifyToken = options.config.webhookVerifyToken || process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
    this.apiVersion = options.config.apiVersion || "v18.0";
    this.baseUrl = `https://graph.facebook.com/${this.apiVersion}`;
    
    this.client = null;
    this.webhookHandler = null;
  }

  /**
   * Connect to WhatsApp
   */
  async connect() {
    this.status = ChannelStatus.CONNECTING;
    this.emit("status", this.status);

    try {
      // Initialize WhatsApp client
      // In production, use whatsapp-web.js or official API
      console.log(`[WhatsApp] Connecting with phone number: ${this.phoneNumberId}`);
      
      // Simulate connection
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      this.status = ChannelStatus.CONNECTED;
      this.emit("status", this.status);
      this.emitEvent("connected", { channelId: this.id });
      
      console.log(`[WhatsApp] Connected successfully`);
      return true;
    } catch (error) {
      this.status = ChannelStatus.ERROR;
      this.emit("status", this.status);
      this.emitEvent("error", { error: error.message });
      
      console.error(`[WhatsApp] Connection failed:`, error.message);
      return false;
    }
  }

  /**
   * Disconnect from WhatsApp
   */
  async disconnect() {
    try {
      if (this.client) {
        // Cleanup client
        this.client = null;
      }
      
      this.status = ChannelStatus.DISCONNECTED;
      this.emit("status", this.status);
      this.emitEvent("disconnected", { channelId: this.id });
      
      console.log(`[WhatsApp] Disconnected`);
      return true;
    } catch (error) {
      console.error(`[WhatsApp] Disconnect error:`, error.message);
      return false;
    }
  }

  /**
   * Send a message
   */
  async sendMessage(recipient, content, options = {}) {
    if (this.status !== ChannelStatus.CONNECTED) {
      throw new Error("WhatsApp channel not connected");
    }

    try {
      const messageType = options.type || MessageType.TEXT;
      const payload = this._buildPayload(recipient, messageType, content, options);
      
      // Send via WhatsApp Business API
      const response = await this._apiRequest("POST", `/${this.phoneNumberId}/messages`, payload);
      
      this.stats.messagesSent++;
      this.stats.lastActivity = Date.now();
      
      return {
        success: true,
        messageId: response.messages?.[0]?.id,
        recipient,
        type: messageType,
      };
    } catch (error) {
      this.stats.errors++;
      throw error;
    }
  }

  /**
   * Reply to a message
   */
  async replyToMessage(messageId, content, options = {}) {
    return this.sendMessage(null, content, {
      ...options,
      replyTo: messageId,
    });
  }

  /**
   * React to a message
   */
  async reactToMessage(messageId, emoji) {
    try {
      const payload = {
        messaging_product: "whatsapp",
        to: this.config.recipientPhoneNumber,
        type: "reaction",
        reaction: {
          message_id: messageId,
          emoji: emoji,
        },
      };
      
      await this._apiRequest("POST", `/${this.phoneNumberId}/messages`, payload);
      
      return { success: true, messageId, emoji };
    } catch (error) {
      this.stats.errors++;
      throw error;
    }
  }

  /**
   * Get channel info
   */
  async getChannelInfo() {
    return {
      id: this.id,
      type: "whatsapp",
      name: this.name,
      phoneNumberId: this.phoneNumberId,
      status: this.status,
      stats: this.stats,
    };
  }

  /**
   * Handle incoming webhook
   */
  async handleWebhook(body) {
    try {
      // Verify webhook
      if (body.object === "whatsapp_business_account") {
        const entry = body.entry?.[0];
        const changes = entry?.changes?.[0];
        
        if (changes?.field === "messages") {
          const value = changes.value;
          
          // Process messages
          if (value.messages) {
            for (const message of value.messages) {
              await this._processMessage(message, value.contacts?.[0]);
            }
          }
          
          // Process statuses
          if (value.statuses) {
            for (const status of value.statuses) {
              this.emitEvent("status_update", status);
            }
          }
        }
      }
      
      return { success: true };
    } catch (error) {
      console.error(`[WhatsApp] Webhook error:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Process incoming message
   */
  async _processMessage(message, contact) {
    const processedMessage = {
      id: message.id,
      from: message.from,
      to: this.phoneNumberId,
      type: this._getMessageType(message.type),
      content: this._extractContent(message),
      timestamp: parseInt(message.timestamp) * 1000,
      sender: contact ? {
        phone: contact.wa_id,
        name: contact.profile?.name,
      } : null,
      channel: "whatsapp",
      raw: message,
    };

    await this.processIncomingMessage(processedMessage);
  }

  /**
   * Build message payload
   */
  _buildPayload(recipient, messageType, content, options) {
    const basePayload = {
      messaging_product: "whatsapp",
      to: recipient || options.recipientPhoneNumber,
      type: messageType,
    };

    switch (messageType) {
      case MessageType.TEXT:
        return {
          ...basePayload,
          text: {
            body: content,
            preview_url: options.previewUrl || false,
          },
        };

      case MessageType.IMAGE:
        return {
          ...basePayload,
          image: {
            link: content.url || content,
            caption: content.caption,
          },
        };

      case MessageType.VIDEO:
        return {
          ...basePayload,
          video: {
            link: content.url || content,
            caption: content.caption,
          },
        };

      case MessageType.AUDIO:
        return {
          ...basePayload,
          audio: {
            link: content.url || content,
          },
        };

      case MessageType.DOCUMENT:
        return {
          ...basePayload,
          document: {
            link: content.url || content,
            filename: content.filename,
            caption: content.caption,
          },
        };

      default:
        return basePayload;
    }
  }

  /**
   * Get message type
   */
  _getMessageType(type) {
    const typeMap = {
      text: MessageType.TEXT,
      image: MessageType.IMAGE,
      video: MessageType.VIDEO,
      audio: MessageType.AUDIO,
      document: MessageType.FILE,
      location: MessageType.LOCATION,
      contact: MessageType.CONTACT,
      sticker: MessageType.STICKER,
    };
    return typeMap[type] || MessageType.TEXT;
  }

  /**
   * Extract content from message
   */
  _extractContent(message) {
    switch (message.type) {
      case "text":
        return message.text?.body;
      case "image":
        return { url: message.image?.id, caption: message.image?.caption };
      case "video":
        return { url: message.video?.id, caption: message.video?.caption };
      case "audio":
        return { url: message.audio?.id };
      case "document":
        return { url: message.document?.id, filename: message.document?.filename };
      default:
        return null;
    }
  }

  /**
   * Make API request
   */
  async _apiRequest(method, endpoint, data) {
    const fetch = globalThis.fetch || (await import("undici")).fetch;
    
    const url = `${this.baseUrl}${endpoint}`;
    const options = {
      method,
      headers: {
        "Authorization": `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      },
    };
    
    if (data && (method === "POST" || method === "PUT")) {
      options.body = JSON.stringify(data);
    }
    
    const response = await fetch(url, options);
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || `API request failed: ${response.status}`);
    }
    
    return await response.json();
  }
}

module.exports = {
  WhatsAppChannel,
};
