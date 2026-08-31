/**
 * Telegram Channel Integration
 * 
 * Integrates with Telegram via Bot API.
 * Supports text, images, videos, audio, documents, stickers, and reactions.
 */

const { BaseChannel, ChannelStatus, MessageType } = require("../base/channel");

/**
 * Telegram Channel
 */
class TelegramChannel extends BaseChannel {
  constructor(options = {}) {
    super({
      ...options,
      type: "telegram",
    });

    this.botToken = options.credentials.botToken || process.env.TELEGRAM_BOT_TOKEN;
    this.baseUrl = `https://api.telegram.org/bot${this.botToken}`;
    this.webhookUrl = options.config.webhookUrl || process.env.TELEGRAM_WEBHOOK_URL;
    this.pollingInterval = options.config.pollingInterval || 1000;
    
    this.client = null;
    this.pollingTimer = null;
    this.lastUpdateId = 0;
  }

  /**
   * Connect to Telegram
   */
  async connect() {
    this.status = ChannelStatus.CONNECTING;
    this.emit("status", this.status);

    try {
      // Get bot info
      const me = await this._apiRequest("getMe");
      console.log(`[Telegram] Bot connected: @${me.username}`);
      
      // Set webhook or start polling
      if (this.webhookUrl) {
        await this._setWebhook();
        console.log(`[Telegram] Webhook set: ${this.webhookUrl}`);
      } else {
        this._startPolling();
        console.log(`[Telegram] Polling started`);
      }
      
      this.status = ChannelStatus.CONNECTED;
      this.emit("status", this.status);
      this.emitEvent("connected", { channelId: this.id, bot: me });
      
      return true;
    } catch (error) {
      this.status = ChannelStatus.ERROR;
      this.emit("status", this.status);
      this.emitEvent("error", { error: error.message });
      
      console.error(`[Telegram] Connection failed:`, error.message);
      return false;
    }
  }

  /**
   * Disconnect from Telegram
   */
  async disconnect() {
    try {
      // Stop polling
      if (this.pollingTimer) {
        clearInterval(this.pollingTimer);
        this.pollingTimer = null;
      }
      
      // Remove webhook
      if (this.webhookUrl) {
        await this._apiRequest("deleteWebhook");
      }
      
      this.status = ChannelStatus.DISCONNECTED;
      this.emit("status", this.status);
      this.emitEvent("disconnected", { channelId: this.id });
      
      console.log(`[Telegram] Disconnected`);
      return true;
    } catch (error) {
      console.error(`[Telegram] Disconnect error:`, error.message);
      return false;
    }
  }

  /**
   * Send a message
   */
  async sendMessage(chatId, content, options = {}) {
    if (this.status !== ChannelStatus.CONNECTED) {
      throw new Error("Telegram channel not connected");
    }

    try {
      const messageType = options.type || MessageType.TEXT;
      const payload = this._buildPayload(chatId, messageType, content, options);
      
      const method = this._getSendMethod(messageType);
      const response = await this._apiRequest(method, payload);
      
      this.stats.messagesSent++;
      this.stats.lastActivity = Date.now();
      
      return {
        success: true,
        messageId: response.result?.message_id,
        chatId,
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
  async replyToMessage(chatId, messageId, content, options = {}) {
    return this.sendMessage(chatId, content, {
      ...options,
      replyToMessageId: messageId,
    });
  }

  /**
   * React to a message
   */
  async reactToMessage(chatId, messageId, emoji) {
    try {
      const payload = {
        chat_id: chatId,
        message_id: messageId,
        reaction: JSON.stringify([{ type: "emoji", emoji }]),
      };
      
      await this._apiRequest("setMessageReaction", payload);
      
      return { success: true, messageId, emoji };
    } catch (error) {
      this.stats.errors++;
      throw error;
    }
  }

  /**
   * Send photo
   */
  async sendPhoto(chatId, photo, caption = "") {
    return this.sendMessage(chatId, { url: photo, caption }, { type: MessageType.IMAGE });
  }

  /**
   * Send video
   */
  async sendVideo(chatId, video, caption = "") {
    return this.sendMessage(chatId, { url: video, caption }, { type: MessageType.VIDEO });
  }

  /**
   * Send audio
   */
  async sendAudio(chatId, audio) {
    return this.sendMessage(chatId, { url: audio }, { type: MessageType.AUDIO });
  }

  /**
   * Send document
   */
  async sendDocument(chatId, document, filename = "") {
    return this.sendMessage(chatId, { url: document, filename }, { type: MessageType.FILE });
  }

  /**
   * Send sticker
   */
  async sendSticker(chatId, sticker) {
    return this.sendMessage(chatId, sticker, { type: MessageType.STICKER });
  }

  /**
   * Get channel info
   */
  async getChannelInfo() {
    const me = await this._apiRequest("getMe");
    return {
      id: this.id,
      type: "telegram",
      name: this.name,
      bot: {
        id: me.id,
        username: me.username,
        firstName: me.first_name,
        canJoinGroups: me.can_join_groups,
        canReadAllGroupMessages: me.can_read_all_group_messages,
        supportsInlineQueries: me.supports_inline_queries,
      },
      status: this.status,
      stats: this.stats,
    };
  }

  /**
   * Handle webhook update
   */
  async handleWebhook(update) {
    try {
      if (update.update_id > this.lastUpdateId) {
        this.lastUpdateId = update.update_id;
      }

      // Process message
      if (update.message) {
        await this._processMessage(update.message);
      }

      // Process edited message
      if (update.edited_message) {
        await this._processMessage(update.edited_message, true);
      }

      // Process callback query
      if (update.callback_query) {
        await this._processCallbackQuery(update.callback_query);
      }

      // Process inline query
      if (update.inline_query) {
        await this._processInlineQuery(update.inline_query);
      }

      return { success: true };
    } catch (error) {
      console.error(`[Telegram] Webhook error:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Process incoming message
   */
  async _processMessage(message, edited = false) {
    const processedMessage = {
      id: message.message_id.toString(),
      chatId: message.chat.id,
      chatType: message.chat.type,
      from: message.from?.id,
      sender: message.from ? {
        id: message.from.id,
        firstName: message.from.first_name,
        lastName: message.from.last_name,
        username: message.from.username,
      } : null,
      type: this._getMessageType(message),
      content: this._extractContent(message),
      timestamp: message.date * 1000,
      edited,
      channel: "telegram",
      raw: message,
    };

    await this.processIncomingMessage(processedMessage);
  }

  /**
   * Process callback query
   */
  async _processCallbackQuery(callbackQuery) {
    this.emitEvent("callback_query", {
      id: callbackQuery.id,
      from: callbackQuery.from,
      data: callbackQuery.data,
      message: callbackQuery.message,
    });
  }

  /**
   * Process inline query
   */
  async _processInlineQuery(inlineQuery) {
    this.emitEvent("inline_query", {
      id: inlineQuery.id,
      from: inlineQuery.from,
      query: inlineQuery.query,
      offset: inlineQuery.offset,
    });
  }

  /**
   * Answer callback query
   */
  async answerCallbackQuery(callbackQueryId, text = "") {
    return this._apiRequest("answerCallbackQuery", {
      callback_query_id: callbackQueryId,
      text,
    });
  }

  /**
   * Answer inline query
   */
  async answerInlineQuery(inlineQueryId, results = []) {
    return this._apiRequest("answerInlineQuery", {
      inline_query_id: inlineQueryId,
      results,
    });
  }

  /**
   * Build message payload
   */
  _buildPayload(chatId, messageType, content, options) {
    const basePayload = {
      chat_id: chatId,
    };

    if (options.replyToMessageId) {
      basePayload.reply_to_message_id = options.replyToMessageId;
    }

    if (options.parseMode) {
      basePayload.parse_mode = options.parseMode;
    }

    switch (messageType) {
      case MessageType.TEXT:
        return {
          ...basePayload,
          text: content,
          disable_web_page_preview: options.disablePreview,
        };

      case MessageType.IMAGE:
        return {
          ...basePayload,
          photo: content.url || content,
          caption: content.caption,
        };

      case MessageType.VIDEO:
        return {
          ...basePayload,
          video: content.url || content,
          caption: content.caption,
        };

      case MessageType.AUDIO:
        return {
          ...basePayload,
          audio: content.url || content,
        };

      case MessageType.FILE:
        return {
          ...basePayload,
          document: content.url || content,
          filename: content.filename,
        };

      case MessageType.STICKER:
        return {
          ...basePayload,
          sticker: content,
        };

      default:
        return basePayload;
    }
  }

  /**
   * Get send method
   */
  _getSendMethod(messageType) {
    const methodMap = {
      [MessageType.TEXT]: "sendMessage",
      [MessageType.IMAGE]: "sendPhoto",
      [MessageType.VIDEO]: "sendVideo",
      [MessageType.AUDIO]: "sendAudio",
      [MessageType.FILE]: "sendDocument",
      [MessageType.STICKER]: "sendSticker",
    };
    return methodMap[messageType] || "sendMessage";
  }

  /**
   * Get message type
   */
  _getMessageType(message) {
    if (message.photo) return MessageType.IMAGE;
    if (message.video) return MessageType.VIDEO;
    if (message.audio || message.voice) return MessageType.AUDIO;
    if (message.document) return MessageType.FILE;
    if (message.sticker) return MessageType.STICKER;
    if (message.location) return MessageType.LOCATION;
    if (message.contact) return MessageType.CONTACT;
    return MessageType.TEXT;
  }

  /**
   * Extract content from message
   */
  _extractContent(message) {
    if (message.text) return message.text;
    if (message.photo) return { url: message.photo[message.photo.length - 1]?.file_id, caption: message.caption };
    if (message.video) return { url: message.video.file_id, caption: message.caption };
    if (message.audio) return { url: message.audio.file_id };
    if (message.voice) return { url: message.voice.file_id };
    if (message.document) return { url: message.document.file_id, filename: message.document.file_name };
    if (message.sticker) return message.sticker.file_id;
    return null;
  }

  /**
   * Start polling for updates
   */
  _startPolling() {
    this.pollingTimer = setInterval(async () => {
      try {
        const updates = await this._apiRequest("getUpdates", {
          offset: this.lastUpdateId + 1,
          timeout: 30,
        });

        for (const update of updates.result || []) {
          await this.handleWebhook(update);
        }
      } catch (error) {
        console.error(`[Telegram] Polling error:`, error.message);
      }
    }, this.pollingInterval);
  }

  /**
   * Set webhook
   */
  async _setWebhook() {
    return this._apiRequest("setWebhook", {
      url: this.webhookUrl,
      allowed_updates: ["message", "edited_message", "callback_query", "inline_query"],
    });
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
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    };
    
    const response = await fetch(url, options);
    const result = await response.json();
    
    if (!result.ok) {
      throw new Error(result.description || `API request failed: ${method}`);
    }
    
    return result;
  }
}

module.exports = {
  TelegramChannel,
};
