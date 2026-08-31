// Server-side 2FA state (kv "security"): secret + enabled flag.
import { makeKv } from "@/lib/db/helpers/kvStore.js";
import { generateTotpSecret } from "@/lib/auth/totp.js";

const kv = makeKv("security");

export async function getTotpConfig() {
  try {
    const secret = await kv.get("totpSecret", null);
    const enabled = (await kv.get("totpEnabled", false)) === true;
    return { secret, enabled };
  } catch {
    return { secret: null, enabled: false };
  }
}

export async function setPendingSecret(secret) {
  await kv.set("totpSecret", secret);
}

export async function enableTotp() {
  const cfg = await getTotpConfig();
  if (!cfg.secret) throw new Error("No pending TOTP secret");
  await kv.set("totpEnabled", true);
  return true;
}

export async function disableTotp() {
  await kv.set("totpEnabled", false);
  await kv.set("totpSecret", null);
  return true;
}

export async function ensureFreshSecret() {
  const cfg = await getTotpConfig();
  if (cfg.secret) return cfg.secret;
  const secret = generateTotpSecret();
  await setPendingSecret(secret);
  return secret;
}
