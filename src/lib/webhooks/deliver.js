import crypto from "node:crypto";

function buildPayload(event, payloadOverride) {
  return {
    event: event || "webhook.test",
    timestamp: new Date().toISOString(),
    payload:
      payloadOverride && typeof payloadOverride === "object"
        ? payloadOverride
        : {
            message: "NovaRoute webhook test event",
          },
  };
}

function signBody(body, secret) {
  if (!secret) return undefined;
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(id);
  }
}

export async function deliverWebhook(url, { secret, event, method = "POST", payload } = {}) {
  const body = JSON.stringify(buildPayload(event, payload));
  const signature = signBody(body, secret);
  const headers = {
    "Content-Type": "application/json",
    "User-Agent": "NovaRoute-Webhook/1.0",
  };
  if (signature) {
    headers["X-Webhook-Signature"] = `sha256=${signature}`;
  }

  try {
    const response = await fetchWithTimeout(
      url,
      { method: method || "POST", headers, body },
      10000
    );
    const ok = response.status >= 200 && response.status < 300;
    return {
      ok,
      status: response.status,
      statusText: response.statusText,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      statusText: error.name === "AbortError" ? "Timeout" : "Network Error",
      error: error.message,
    };
  }
}
