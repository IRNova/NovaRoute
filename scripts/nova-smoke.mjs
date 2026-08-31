#!/usr/bin/env node
// NovaRoute deployment smoke test.
//
// Verifies the full management + gateway stack without a browser:
//   health → authed settings → create API key → /v1/models with that key
//   → optional real chat completion (SMOKE_WITH_CHAT=1) → delete key
//
// Auth: mints a dashboard session cookie from JWT_SECRET (+ current revocation
// epoch read straight from SQLite), so no dashboard password is needed.
//
// Usage:
//   node --env-file=.env scripts/nova-smoke.mjs [--base http://localhost:20126]
//   SMOKE_WITH_CHAT=1 node --env-file=.env scripts/nova-smoke.mjs
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const args = process.argv.slice(2);
const baseIdx = args.indexOf("--base");
const BASE = (baseIdx !== -1 ? args[baseIdx + 1] : null) || `http://localhost:${process.env.PORT || 20126}`;
const WITH_CHAT = process.env.SMOKE_WITH_CHAT === "1";

let passed = 0;
let failed = 0;
function step(name, ok, detail = "") {
  if (ok) passed++;
  else failed++;
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
}

async function call(pathname, { method = "GET", body, cookie, bearer } = {}) {
  const headers = {};
  const rawBody =
    body === undefined
      ? undefined
      : typeof body === "string"
        ? body
        : JSON.stringify(body);
  if (rawBody !== undefined) headers["Content-Type"] = "application/json";
  if (cookie) headers["Cookie"] = cookie;
  if (bearer) headers["Authorization"] = `Bearer ${bearer}`;
  const res = await fetch(`${BASE}${pathname}`, {
    method,
    headers,
    body: rawBody,
    signal: AbortSignal.timeout(30_000),
  });
  let json = null;
  try { json = await res.json(); } catch {}
  return { res, json };
}

async function readJwtEpoch() {
  // Read the session-revocation epoch straight from SQLite (node:sqlite is
  // built into Node ≥22.5). Default "0" mirrors dashboardSession logic.
  try {
    const dataDir = process.env.DATA_DIR || path.join(process.env.HOME || "", ".novaroute");
    const dbPath = path.join(dataDir, "db", "data.sqlite");
    if (!fs.existsSync(dbPath)) return "0";
    const { DatabaseSync } = await import("node:sqlite");
    const db = new DatabaseSync(dbPath, { readOnly: true });
    const row = db.prepare(`SELECT value FROM kv WHERE scope='security' AND key='jwtEpoch'`).get();
    db.close();
    return row ? String(JSON.parse(row.value)) : "0";
  } catch {
    return "0";
  }
}

async function main() {
  console.log(`NovaRoute smoke @ ${BASE}\n`);

  // 1. Health
  try {
    const r = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(10_000) });
    const j = await r.json().catch(() => null);
    step("health", r.ok && j?.ok === true);
  } catch (e) {
    step("health", false, e.message);
  }

  // 2. Mint admin cookie
  if (!process.env.JWT_SECRET) {
    step("mint admin cookie", false, "JWT_SECRET missing from environment");
    finish();
    return;
  }
  const epoch = await readJwtEpoch();
  const secretBytes = new TextEncoder().encode(
    epoch === "0" ? process.env.JWT_SECRET : `${process.env.JWT_SECRET}:${epoch}`
  );
  const { SignJWT } = await import("jose");
  const sid = crypto.randomUUID();
  const token = await new SignJWT({ authenticated: true, sid })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(secretBytes);
  const cookie = `auth_token=${token}`;

  // 3. Authenticated settings read (proves guard accepts the minted session)
  {
    const { res, json } = await call("/api/settings", { cookie });
    step("authed /api/settings", res.ok && json && typeof json === "object" && !json.error,
      res.ok ? "" : `status ${res.status}`);
  }

  // 4. Create API key
  const keyName = `smoke-${Date.now()}`;
  let keyId = null;
  let keyValue = null;
  {
    const { res, json } = await call("/api/keys", {
      method: "POST",
      cookie,
      body: JSON.stringify({ name: keyName, scopes: ["chat"] }),
    });
    keyId = json?.id || null;
    keyValue = json?.key || null;
    step("create API key", res.status === 201 && !!keyValue,
      res.ok ? "" : `status ${res.status} body ${JSON.stringify(json)?.slice(0, 150)}`);
  }

  // 5. Gateway models list with the fresh key
  if (keyValue) {
    const { res, json } = await call("/v1/models", { bearer: keyValue });
    step("/v1/models with key", res.ok && Array.isArray(json?.data), res.ok ? `${json.data.length} models` : `status ${res.status}`);
  }

  // 6. Optional real chat completion (costs a few tokens)
  if (WITH_CHAT && keyValue) {
    try {
      const modelsRes = await call("/v1/models", { bearer: keyValue });
      const first = modelsRes.json?.data?.[0]?.id;
      if (!first) throw new Error("no model available");
      const { res, json } = await call("/api/v1/chat/completions", {
        method: "POST",
        bearer: keyValue,
        body: JSON.stringify({
          model: first,
          messages: [{ role: "user", content: "Reply with the single word: ok" }],
          max_tokens: 5,
          stream: false,
        }),
      });
      const okShape = res.ok && Array.isArray(json?.choices);
      step("chat completion", okShape, okShape ? `"${json.choices?.[0]?.message?.content?.slice(0, 20)}"` : `status ${res.status}`);
    } catch (e) {
      step("chat completion", false, e.message);
    }
  } else {
    console.log("· chat completion skipped (set SMOKE_WITH_CHAT=1 to include)");
  }

  // 7. Cleanup key
  if (keyId) {
    const { res } = await call(`/api/keys/${keyId}`, { method: "DELETE", cookie });
    step("delete API key", res.ok || res.status === 200, "");
  }

  finish();
}

function finish() {
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("smoke crashed:", e.message);
  process.exit(1);
});
