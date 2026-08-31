// OpenTelemetry tracing for the gateway, without the OpenTelemetry SDK.
//
// The SDK plus its exporters is ~40 packages, and this project deliberately
// ships almost no runtime dependencies. The wire format is simple, so spans are
// built here and POSTed as OTLP/HTTP JSON to any collector (Grafana Alloy,
// otel-collector, Jaeger, Tempo, Honeycomb, …).
//
// Off unless OTEL_EXPORTER_OTLP_ENDPOINT (or ..._TRACES_ENDPOINT) is set:
//   OTEL_EXPORTER_OTLP_ENDPOINT=http://collector:4318
//   OTEL_EXPORTER_OTLP_HEADERS=x-api-key=abc,team=core   (optional)
//   OTEL_SERVICE_NAME=novaroute                          (optional)
//
// Attribute names follow the OpenTelemetry GenAI semantic conventions
// (gen_ai.*), so an off-the-shelf LLM dashboard understands the spans.

import { AsyncLocalStorage } from "node:async_hooks";
import crypto from "node:crypto";

const storage = new AsyncLocalStorage();

const MAX_QUEUE = 1_000;
const BATCH_SIZE = 100;
const FLUSH_INTERVAL_MS = 5_000;
const EXPORT_TIMEOUT_MS = 10_000;

let queue = [];
let flushTimer = null;
let warnedOnce = false;

function tracesEndpoint() {
  const explicit = process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT;
  if (explicit) return explicit;
  const base = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  return base ? `${base.replace(/\/$/, "")}/v1/traces` : null;
}

export function isTracingEnabled() {
  return !!tracesEndpoint();
}

function parseHeaders() {
  const raw = process.env.OTEL_EXPORTER_OTLP_HEADERS || "";
  const headers = { "content-type": "application/json" };
  for (const pair of raw.split(",")) {
    const idx = pair.indexOf("=");
    if (idx <= 0) continue;
    headers[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim();
  }
  return headers;
}

const serviceName = () => process.env.OTEL_SERVICE_NAME || "novaroute";

function toAnyValue(value) {
  if (typeof value === "number") {
    return Number.isInteger(value) ? { intValue: String(value) } : { doubleValue: value };
  }
  if (typeof value === "boolean") return { boolValue: value };
  return { stringValue: String(value) };
}

function toAttributes(obj) {
  return Object.entries(obj || {})
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([key, value]) => ({ key, value: toAnyValue(value) }));
}

/* ── export ────────────────────────────────────────────────────────── */

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flush();
  }, FLUSH_INTERVAL_MS);
  flushTimer.unref?.();
}

export async function flush() {
  const endpoint = tracesEndpoint();
  if (!endpoint || queue.length === 0) return;

  const batch = queue.splice(0, BATCH_SIZE);
  const payload = {
    resourceSpans: [
      {
        resource: {
          attributes: toAttributes({
            "service.name": serviceName(),
            "service.version": process.env.npm_package_version || "",
            "telemetry.sdk.name": "novaroute-inline",
            "telemetry.sdk.language": "nodejs",
          }),
        },
        scopeSpans: [{ scope: { name: "novaroute/gateway" }, spans: batch }],
      },
    ],
  };

  try {
    await fetch(endpoint, {
      method: "POST",
      headers: parseHeaders(),
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(EXPORT_TIMEOUT_MS),
    });
  } catch (error) {
    // A collector being down must never affect serving. Say it once.
    if (!warnedOnce) {
      warnedOnce = true;
      console.warn(`[otel] trace export failed (further errors suppressed): ${error?.message || error}`);
    }
  }
  if (queue.length) scheduleFlush();
}

function enqueue(span) {
  if (queue.length >= MAX_QUEUE) queue.shift(); // drop oldest, keep serving
  queue.push(span);
  if (queue.length >= BATCH_SIZE) void flush();
  else scheduleFlush();
}

/* ── spans ─────────────────────────────────────────────────────────── */

const SPAN_KIND_SERVER = 2;
const STATUS_OK = 1;
const STATUS_ERROR = 2;

function hex(bytes) {
  return crypto.randomBytes(bytes).toString("hex");
}

/** Attributes added to the span the current request is running inside. */
export function annotateSpan(attributes) {
  const current = storage.getStore();
  if (!current) return;
  Object.assign(current.attributes, attributes || {});
}

/** The current span record, or null outside a traced request. */
export function currentSpan() {
  return storage.getStore() || null;
}

/**
 * Run `fn` inside a span. When tracing is disabled this is a direct call with
 * no allocation, so leaving the wrappers in place costs nothing.
 *
 * @param {string} name
 * @param {object} attributes
 * @param {Function} fn
 */
export async function withSpan(name, attributes, fn) {
  if (!isTracingEnabled()) return fn();

  const startTime = process.hrtime.bigint();
  const startUnixNano = BigInt(Date.now()) * 1_000_000n;
  const record = {
    traceId: hex(16),
    spanId: hex(8),
    name,
    attributes: { ...attributes },
    error: null,
  };

  try {
    const result = await storage.run(record, fn);
    finish(record, startUnixNano, startTime, null);
    return result;
  } catch (error) {
    finish(record, startUnixNano, startTime, error);
    throw error;
  }
}

function finish(record, startUnixNano, startHr, error) {
  const durationNanos = process.hrtime.bigint() - startHr;
  const status = error || record.attributes["http.response.status_code"] >= 500
    ? { code: STATUS_ERROR, message: String(error?.message || "").slice(0, 200) }
    : { code: STATUS_OK };

  enqueue({
    traceId: record.traceId,
    spanId: record.spanId,
    name: record.name,
    kind: SPAN_KIND_SERVER,
    startTimeUnixNano: String(startUnixNano),
    endTimeUnixNano: String(startUnixNano + durationNanos),
    attributes: toAttributes(record.attributes),
    status,
  });
}

/**
 * Report the usage of one upstream call.
 *
 * Streaming responses finish after the handler has returned, so the token
 * counts can arrive once the request span is already closed. When that happens
 * the numbers are emitted as their own short span instead of being dropped.
 */
export function recordUsageSpan({ provider, model, promptTokens, completionTokens, costUsd, endpoint }) {
  if (!isTracingEnabled()) return;
  const attributes = {
    "gen_ai.system": provider,
    "gen_ai.request.model": model,
    "gen_ai.usage.input_tokens": promptTokens,
    "gen_ai.usage.output_tokens": completionTokens,
    "novaroute.cost_usd": costUsd,
    "novaroute.endpoint": endpoint,
  };

  const current = storage.getStore();
  if (current) {
    Object.assign(current.attributes, attributes);
    return;
  }

  const now = BigInt(Date.now()) * 1_000_000n;
  enqueue({
    traceId: hex(16),
    spanId: hex(8),
    name: "novaroute usage",
    kind: SPAN_KIND_SERVER,
    startTimeUnixNano: String(now),
    endTimeUnixNano: String(now),
    attributes: toAttributes(attributes),
    status: { code: STATUS_OK },
  });
}

/**
 * Wrap a gateway handler so every call becomes a span.
 * @param {string} name span name, e.g. "chat.completions"
 * @param {Function} handler (request, ...rest) => Response
 */
export function tracedHandler(name, handler) {
  return async function traced(request, ...rest) {
    return withSpan(
      `novaroute ${name}`,
      {
        "http.request.method": request?.method || "POST",
        "url.path": (() => {
          try {
            return new URL(request.url).pathname;
          } catch {
            return "";
          }
        })(),
        "novaroute.surface": name,
      },
      async () => {
        const response = await handler(request, ...rest);
        const status = response?.status;
        if (status) annotateSpan({ "http.response.status_code": status });
        return response;
      }
    );
  };
}

/** Test seam. */
export const __test__ = {
  toAttributes,
  drain: () => queue.splice(0, queue.length),
  size: () => queue.length,
};
