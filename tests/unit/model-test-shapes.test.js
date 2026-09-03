// Judging whether a model actually answered.
// Runs with: node --test "tests/unit/*.test.js"
//
// "Every time I run a test, it marks all models as inactive, even though I am
// sure some of them are working." The check accepted three response shapes and
// rejected everything else. Anthropic returns `content` as an ARRAY of blocks,
// never a string, so a perfectly good reply was read as no completion at all.
import test from "node:test";
import assert from "node:assert/strict";
import "./aliasHook.mjs";

const { looksLikeCompletion, extractPreview } = await import("@/lib/providerModelTools");

// Real response envelopes, trimmed.
const ANTHROPIC = { id: "msg_1", type: "message", role: "assistant", model: "claude-3-haiku", content: [{ type: "text", text: "Hi there" }] };
const OPENAI = { id: "chatcmpl-1", choices: [{ index: 0, message: { role: "assistant", content: "Hi there" } }] };
const OPENAI_RESPONSES = { id: "resp_1", output: [{ type: "message", content: [{ type: "output_text", text: "Hi there" }] }] };
const OPENAI_RESPONSES_FLAT = { id: "resp_2", output_text: "Hi there" };
const GEMINI = { candidates: [{ content: { parts: [{ text: "Hi there" }] } }] };
const OLLAMA_CHAT = { model: "llama3", message: { role: "assistant", content: "Hi there" } };
const OLLAMA_GENERATE = { model: "llama3", response: "Hi there" };

test("an Anthropic reply counts as working", () => {
  // The exact case that made every Anthropic-format provider look dead.
  assert.equal(looksLikeCompletion(ANTHROPIC), true);
  assert.equal(extractPreview(ANTHROPIC), "Hi there");
});

test("every wire format the gateway talks to counts as working", () => {
  for (const [name, body] of Object.entries({
    OPENAI, OPENAI_RESPONSES, OPENAI_RESPONSES_FLAT, GEMINI, OLLAMA_CHAT, OLLAMA_GENERATE,
  })) {
    assert.equal(looksLikeCompletion(body), true, `${name} judged a failure`);
    assert.equal(extractPreview(body), "Hi there", `${name} preview not extracted`);
  }
});

test("an empty or error-shaped body is still a failure", () => {
  for (const body of [
    null, undefined, {}, "text", 42,
    { choices: [] },
    { content: [] },
    { content: "" },
    { candidates: [] },
    { output: [] },
    { error: { message: "model not found" } },
  ]) {
    assert.equal(looksLikeCompletion(body), false, `${JSON.stringify(body)} judged a success`);
  }
});

test("a completion with empty text still counts, the model answered", () => {
  // A model that returns an empty string has responded; that is not an outage.
  assert.equal(looksLikeCompletion({ choices: [{ message: { content: "" } }] }), true);
});

test("the preview never returns a non-string", () => {
  for (const body of [ANTHROPIC, OPENAI, GEMINI, {}, null, { content: [{ type: "image" }] }]) {
    const p = extractPreview(body);
    assert.ok(p === null || typeof p === "string", `preview was ${typeof p}`);
  }
});
