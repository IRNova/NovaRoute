// The generic webhook channel: payload mapping, templating and inbound guard.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { WebhookChannel, __test__ } = require("../../src/lib/channels/webhook/webhookChannel.js");

test("dotted paths read nested payloads, and a missing path reads as undefined", () => {
  const payload = { message: { body: "hello", from: { id: "u1" } } };
  assert.equal(__test__.pick(payload, "message.body"), "hello");
  assert.equal(__test__.pick(payload, "message.from.id"), "u1");
  assert.equal(__test__.pick(payload, "message.missing.deep"), undefined);
  assert.equal(__test__.pick(payload, ""), undefined);
});

test("the body template substitutes only known placeholders", () => {
  const rendered = __test__.render('{"chat":"{{chat}}","text":"{{text}}","x":"{{unknown}}"}', {
    chat: "!room:example.org",
    text: "hi",
  });
  assert.equal(rendered, '{"chat":"!room:example.org","text":"hi","x":""}');
});

test("an inbound payload becomes a normalised message", () => {
  const channel = new WebhookChannel({
    name: "matrix",
    config: { textPath: "message.body", senderPath: "sender", chatPath: "room_id" },
    credentials: { secret: "s3cret" },
  });

  const received = [];
  channel.on("message", (m) => received.push(m));

  const message = channel.ingest({
    message: { body: "hello from matrix" },
    sender: "@ali:matrix.org",
    room_id: "!abc:matrix.org",
  });

  assert.equal(message.text, "hello from matrix");
  assert.equal(message.sender, "@ali:matrix.org");
  assert.equal(message.chat, "!abc:matrix.org");
  assert.equal(received.length, 1, "listeners are notified");
  assert.equal(channel.stats.messagesReceived, 1);
});

test("a payload with nothing at the configured path is rejected, not guessed at", () => {
  const channel = new WebhookChannel({ config: { textPath: "message.body" }, credentials: { secret: "x" } });
  assert.equal(channel.ingest({ something: "else" }), null);
  assert.equal(channel.stats.messagesReceived, 0);
});

test("a channel without a secret mints one instead of being open", () => {
  const channel = new WebhookChannel({ config: {}, credentials: {} });
  assert.match(channel.secret, /^[0-9a-f]{48}$/);
});

test("outbound requires a URL, and an inbound-only channel still connects", async () => {
  const inboundOnly = new WebhookChannel({ config: {}, credentials: {} });
  assert.equal(await inboundOnly.connect(), true);
  await assert.rejects(() => inboundOnly.sendMessage("chat", "text"), /no outboundUrl/);

  const badUrl = new WebhookChannel({ config: { outboundUrl: "not a url" }, credentials: {} });
  assert.equal(await badUrl.connect(), false);
});
