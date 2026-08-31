/**
 * Generic Webhook Channel
 *
 * The built-in adapters cover four platforms. Everything else with an HTTP API
 * (Matrix, Mattermost, Rocket.Chat, Teams, an SMS gateway, a signal-cli bridge,
 * an internal bus) can be reached through this one instead of waiting for a
 * bespoke adapter:
 *
 *   outbound  POST to `config.outboundUrl` with a JSON body built from
 *             `config.bodyTemplate`, where {{text}}, {{chat}} and {{channel}}
 *             are substituted. Extra headers come from `credentials.headers`.
 *   inbound   POST /api/channels/webhook/<channelId> carrying the channel's
 *             secret in the X-Channel-Secret header; `config.textPath` and
 *             `config.senderPath` say where the message and sender live in the
 *             payload (dotted paths, e.g. "message.text").
 *
 * Nothing here is platform-specific on purpose. Configuring it is the price of
 * not having to ship, and maintain, twenty adapters.
 */

const crypto = require("crypto");
const { BaseChannel, ChannelStatus, MessageType } = require("../base/channel");

/** Read "a.b.c" out of an object. */
function pick(obj, path) {
  if (!path) return undefined;
  return String(path)
    .split(".")
    .reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

function render(template, values) {
  return String(template).replace(/\{\{(\w+)\}\}/g, (_, key) =>
    values[key] === undefined || values[key] === null ? "" : String(values[key])
  );
}

class WebhookChannel extends BaseChannel {
  constructor(options = {}) {
    super({ ...options, type: "webhook" });

    const config = options.config || {};
    const credentials = options.credentials || {};

    this.outboundUrl = config.outboundUrl || "";
    this.bodyTemplate = config.bodyTemplate || '{"chat":"{{chat}}","text":"{{text}}"}';
    this.textPath = config.textPath || "text";
    this.senderPath = config.senderPath || "sender";
    this.chatPath = config.chatPath || "chat";
    this.headers = credentials.headers || {};
    // Inbound requests must present this. Generated when absent so a channel is
    // never accidentally open to the internet.
    this.secret = credentials.secret || crypto.randomBytes(24).toString("hex");
  }

  async connect() {
    this.status = ChannelStatus.CONNECTING;
    this.emit("status", this.status);

    if (!this.outboundUrl) {
      // Inbound-only is a legitimate setup: receive messages, reply elsewhere.
      this.status = ChannelStatus.CONNECTED;
      this.emit("status", this.status);
      return true;
    }

    try {
      new URL(this.outboundUrl);
      this.status = ChannelStatus.CONNECTED;
      this.emit("status", this.status);
      this.emitEvent("connected", { channelId: this.id });
      return true;
    } catch {
      this.status = ChannelStatus.ERROR;
      this.emit("status", this.status);
      this.emitEvent("error", { error: "outboundUrl is not a valid URL" });
      return false;
    }
  }

  async disconnect() {
    this.status = ChannelStatus.DISCONNECTED;
    this.emit("status", this.status);
    return true;
  }

  async sendMessage(chat, content, options = {}) {
    if (!this.outboundUrl) throw new Error("this webhook channel has no outboundUrl");

    const body = render(this.bodyTemplate, {
      text: String(content ?? "").replace(/"/g, '\\"'),
      chat: chat ?? "",
      channel: this.name,
    });

    const res = await fetch(this.outboundUrl, {
      method: options.method || "POST",
      headers: { "content-type": "application/json", ...this.headers },
      body,
      signal: AbortSignal.timeout(20000),
    });

    this.stats.messagesSent += 1;
    this.stats.lastActivity = new Date().toISOString();

    if (!res.ok) {
      this.stats.errors += 1;
      throw new Error(`webhook target answered ${res.status}`);
    }
    return { ok: true, status: res.status };
  }

  /** Turn an inbound payload into a normalised message and emit it. */
  ingest(payload) {
    const text = pick(payload, this.textPath);
    if (text === undefined) return null;

    const message = {
      id: crypto.randomUUID(),
      type: MessageType.TEXT,
      text: String(text),
      sender: String(pick(payload, this.senderPath) ?? "unknown"),
      chat: String(pick(payload, this.chatPath) ?? ""),
      receivedAt: new Date().toISOString(),
      raw: payload,
    };

    this.stats.messagesReceived += 1;
    this.stats.lastActivity = message.receivedAt;
    this.emit("message", message);
    return message;
  }
}

module.exports = { WebhookChannel, __test__: { pick, render } };
