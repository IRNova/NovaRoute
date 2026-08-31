// OTLP tracing: disabled by default, correct wire shape when enabled.
import test from "node:test";
import assert from "node:assert/strict";

const ENDPOINT_VARS = ["OTEL_EXPORTER_OTLP_ENDPOINT", "OTEL_EXPORTER_OTLP_TRACES_ENDPOINT"];
const saved = Object.fromEntries(ENDPOINT_VARS.map((k) => [k, process.env[k]]));

function disableTracing() {
  for (const k of ENDPOINT_VARS) delete process.env[k];
}
function enableTracing() {
  process.env.OTEL_EXPORTER_OTLP_ENDPOINT = "http://127.0.0.1:1/collector";
}

test.after(() => {
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

const otel = await import("../../src/lib/monitoring/otel.js");

test("tracing is off unless an OTLP endpoint is configured", async () => {
  disableTracing();
  assert.equal(otel.isTracingEnabled(), false);
  otel.__test__.drain();

  const result = await otel.withSpan("ignored", { a: 1 }, async () => "value");
  assert.equal(result, "value", "the wrapped function still runs");
  assert.equal(otel.__test__.size(), 0, "no span is queued while disabled");
});

test("an enabled span captures name, attributes and timing", async () => {
  enableTracing();
  otel.__test__.drain();

  await otel.withSpan("novaroute chat.completions", { "url.path": "/v1/chat/completions" }, async () => {
    otel.annotateSpan({ "gen_ai.request.model": "gpt-4o-mini" });
    return { status: 200 };
  });

  const [span] = otel.__test__.drain();
  assert.ok(span, "a span was queued");
  assert.equal(span.name, "novaroute chat.completions");
  assert.match(span.traceId, /^[0-9a-f]{32}$/);
  assert.match(span.spanId, /^[0-9a-f]{16}$/);
  assert.equal(span.status.code, 1);
  assert.ok(BigInt(span.endTimeUnixNano) >= BigInt(span.startTimeUnixNano));

  const attrs = Object.fromEntries(span.attributes.map((a) => [a.key, a.value]));
  assert.deepEqual(attrs["url.path"], { stringValue: "/v1/chat/completions" });
  assert.deepEqual(attrs["gen_ai.request.model"], { stringValue: "gpt-4o-mini" });
});

test("a throwing handler still produces a span, marked as an error", async () => {
  enableTracing();
  otel.__test__.drain();

  await assert.rejects(
    otel.withSpan("novaroute chat.completions", {}, async () => {
      throw new Error("upstream exploded");
    }),
    /upstream exploded/
  );

  const [span] = otel.__test__.drain();
  assert.equal(span.status.code, 2);
  assert.match(span.status.message, /upstream exploded/);
});

test("usage arriving after the span closed becomes its own span", async () => {
  enableTracing();
  otel.__test__.drain();

  // Outside any span: a streaming response reports tokens once the handler
  // has already returned.
  otel.recordUsageSpan({
    provider: "openai",
    model: "gpt-4o-mini",
    promptTokens: 120,
    completionTokens: 8,
    costUsd: 0.00042,
    endpoint: "/v1/chat/completions",
  });

  const [span] = otel.__test__.drain();
  assert.equal(span.name, "novaroute usage");
  const attrs = Object.fromEntries(span.attributes.map((a) => [a.key, a.value]));
  assert.deepEqual(attrs["gen_ai.system"], { stringValue: "openai" });
  assert.deepEqual(attrs["gen_ai.usage.input_tokens"], { intValue: "120" });
  assert.deepEqual(attrs["novaroute.cost_usd"], { doubleValue: 0.00042 });
});

test("usage inside a span enriches that span instead of making a new one", async () => {
  enableTracing();
  otel.__test__.drain();

  await otel.withSpan("novaroute chat.completions", {}, async () => {
    otel.recordUsageSpan({ provider: "anthropic", model: "claude-sonnet-4", promptTokens: 10, completionTokens: 2 });
  });

  const spans = otel.__test__.drain();
  assert.equal(spans.length, 1, "one span, not two");
  const attrs = Object.fromEntries(spans[0].attributes.map((a) => [a.key, a.value]));
  assert.deepEqual(attrs["gen_ai.system"], { stringValue: "anthropic" });
});

test("the queue is bounded so a dead collector cannot grow it forever", async () => {
  enableTracing();
  otel.__test__.drain();
  for (let i = 0; i < 1200; i++) {
    otel.recordUsageSpan({ provider: "p", model: "m", promptTokens: i, completionTokens: 0 });
  }
  assert.ok(otel.__test__.size() <= 1000, `queue held ${otel.__test__.size()} spans`);
});
