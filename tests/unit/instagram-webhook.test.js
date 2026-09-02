// Instagram webhook reachability and verification.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const guard = fs.readFileSync(path.join(ROOT, "src/dashboardGuard.js"), "utf8");
const route = fs.readFileSync(path.join(ROOT, "src/app/api/dashboard/nova/instagram/webhook/route.js"), "utf8");
const lib = fs.readFileSync(path.join(ROOT, "src/lib/nova/instagram.js"), "utf8");

test("the Instagram webhook is reachable, like the Telegram one", () => {
  // Meta cannot carry a dashboard session. Telegram was on the public list and
  // Instagram was not, so every delivery was refused with 401 before reaching
  // the handler: "Telegram works well, Instagram has issues".
  assert.ok(guard.includes('"/api/dashboard/nova/telegram/webhook"'));
  assert.ok(guard.includes('"/api/dashboard/nova/instagram/webhook"'), "Instagram deliveries are still refused by the guard");
});

test("being reachable, it refuses to run without a verifiable signature", () => {
  // The signature is the only thing in front of it now, and it hands its
  // payload to the agent, so "verify only if a secret happens to be set" is
  // fail-open.
  assert.ok(!/if \(config\.appSecret\) \{/.test(route), "signature verification is conditional again");
  assert.match(route, /if \(!config\.appSecret\)/, "no refusal when the app secret is missing");
  assert.match(route, /status: 503/, "missing secret does not refuse the delivery");
  assert.match(route, /status: 403/, "an invalid signature is not rejected");
});

test("the subscribe handshake compares in constant time", () => {
  assert.ok(!/token === verifyToken/.test(lib), "handshake is back to a plain string compare");
  assert.match(lib, /timingSafeEqual\(a, b\)/);
});
