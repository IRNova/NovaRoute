#!/usr/bin/env node
// NovaRoute security posture check — reads .env, the SQLite settings and file
// permissions of a real install and reports what an attacker would find.
//
//   node scripts/nova-security-audit.mjs            # English
//   node scripts/nova-security-audit.mjs --fa       # Farsi
//   node scripts/nova-security-audit.mjs --json     # machine readable
//
// No dependencies: the database is read through node:sqlite when available
// (Node >= 22), otherwise the DB checks are reported as skipped.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FA = process.argv.includes("--fa");
const JSON_OUT = process.argv.includes("--json");

// Farsi output is right-to-left, but every command, path and variable name in
// it is left-to-right. Without isolates the terminal reorders them (a line like
// "chmod 600 file" ends up reversed), so each Latin run is wrapped in
// U+2066 LRI ... U+2069 PDI.
const LRI = "\u2066";
const PDI = "\u2069";
const LATIN_RUN = /[A-Za-z0-9_/.:@=+-]+(?: +[A-Za-z0-9_/.:@=+-]+)*/g;
const isolate = (text) =>
  FA
    ? String(text).replace(LATIN_RUN, (run) => (/[A-Za-z0-9]/.test(run) ? LRI + run + PDI : run))
    : text;

const findings = [];
const add = (level, id, en, fa, fix = { en: "", fa: "" }) =>
  findings.push({ level, id, title: FA ? fa : en, fix: FA ? fix.fa : fix.en });

const critical = (...a) => add("critical", ...a);
const warn = (...a) => add("warning", ...a);
const ok = (...a) => add("ok", ...a);

/* ── env ──────────────────────────────────────────────────────────── */

function loadEnv() {
  const file = path.join(ROOT, ".env");
  const env = { ...process.env };
  if (!fs.existsSync(file)) return { env, envFile: null };
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m && env[m[1]] === undefined) env[m[1]] = m[2].trim();
  }
  return { env, envFile: file };
}

const { env, envFile } = loadEnv();

if (envFile) {
  const mode = fs.statSync(envFile).mode & 0o777;
  if (mode & 0o077) {
    warn(
      "env-perms",
      `.env is readable by other users on this machine (mode ${mode.toString(8)})`,
      `فایل .env برای کاربران دیگر این سیستم قابل خواندن است (دسترسی ${mode.toString(8)})`,
      { en: "chmod 600 .env", fa: "دستور chmod 600 .env را اجرا کنید" }
    );
  } else {
    ok("env-perms", ".env permissions are restricted", "دسترسی فایل .env محدود است");
  }
}

const secretLooksWeak = (v) => !v || v.length < 24 || /change-me|secret|password|endpoint-proxy/i.test(v);

if (secretLooksWeak(env.JWT_SECRET)) {
  critical(
    "jwt-secret",
    "JWT_SECRET is missing, short or still the example value — session cookies can be forged",
    "مقدار JWT_SECRET تنظیم نشده، کوتاه است یا هنوز مقدار نمونه است؛ کوکی نشست قابل جعل می‌شود",
    {
      en: "Set JWT_SECRET to 64 random hex characters: openssl rand -hex 32",
      fa: "برای JWT_SECRET یک مقدار تصادفی ۶۴ کاراکتری بگذارید: openssl rand -hex 32",
    }
  );
} else {
  ok("jwt-secret", "JWT_SECRET is set and long enough", "مقدار JWT_SECRET تنظیم شده و طول کافی دارد");
}

if (!env.API_KEY_SECRET || secretLooksWeak(env.API_KEY_SECRET)) {
  warn(
    "field-encryption",
    "API_KEY_SECRET is not set — provider API keys and OAuth tokens are stored in plain text",
    "مقدار API_KEY_SECRET تنظیم نشده؛ کلیدهای ارائه‌دهنده‌ها و توکن‌های OAuth به‌صورت متن ساده ذخیره می‌شوند",
    {
      en: "Set API_KEY_SECRET (openssl rand -hex 24) and restart; values are encrypted on next write.",
      fa: "مقدار API_KEY_SECRET را تنظیم و سرویس را ری‌استارت کنید؛ مقادیر در نوبت نوشتن بعدی رمز می‌شوند.",
    }
  );
} else {
  ok("field-encryption", "Credential encryption at rest is enabled", "رمزگذاری اعتبارنامه‌ها روی دیسک فعال است");
}

if (env.ADMIN_MASTER_PASSWORD) {
  critical(
    "master-password",
    "ADMIN_MASTER_PASSWORD is still set — this break-glass password always grants dashboard access",
    "مقدار ADMIN_MASTER_PASSWORD هنوز تنظیم است؛ این رمز اضطراری همیشه اجازه ورود به داشبورد می‌دهد",
    { en: "Remove it from .env once you have regained access.", fa: "پس از بازیابی دسترسی، آن را از .env حذف کنید." }
  );
}

if (env.INITIAL_PASSWORD && env.INITIAL_PASSWORD.length < 12) {
  warn(
    "initial-password",
    "INITIAL_PASSWORD is short — it is a working dashboard password until one is set in the UI",
    "مقدار INITIAL_PASSWORD کوتاه است؛ تا وقتی رمزی در پنل تنظیم نشود، این رمز کار می‌کند",
    { en: "Finish first-time setup, then remove INITIAL_PASSWORD.", fa: "تنظیم اولیه را کامل کنید و سپس INITIAL_PASSWORD را حذف کنید." }
  );
}

const exposed = (env.HOSTNAME || "") === "0.0.0.0";
const hasTls = !!(env.BASE_URL || "").startsWith("https://");
if (exposed && !hasTls) {
  warn(
    "plain-http",
    "The server listens on every interface over plain HTTP — the dashboard password and API keys cross the network unencrypted",
    "سرویس روی همهٔ رابط‌های شبکه و روی HTTP ساده گوش می‌دهد؛ رمز داشبورد و کلیدهای API رمزنگاری‌نشده جابه‌جا می‌شوند",
    {
      en: "Point a domain at it and re-run install.sh so Caddy terminates TLS, or bind HOSTNAME=127.0.0.1 behind your own proxy.",
      fa: "یک دامنه به آن بدهید و install.sh را دوباره اجرا کنید تا Caddy گواهی TLS بگیرد، یا HOSTNAME=127.0.0.1 بگذارید و از پروکسی خودتان استفاده کنید.",
    }
  );
}

if (env.NR_ALLOW_ANONYMOUS_REMOTE_API === "1") {
  critical(
    "anonymous-remote",
    "NR_ALLOW_ANONYMOUS_REMOTE_API=1 — anyone on the internet can use /v1 without a key",
    "مقدار NR_ALLOW_ANONYMOUS_REMOTE_API=1 است؛ هر کسی روی اینترنت می‌تواند بدون کلید از /v1 استفاده کند",
    { en: "Remove it unless this is a deliberately public gateway.", fa: "اگر عمداً دروازه را عمومی نکرده‌اید، آن را حذف کنید." }
  );
}

/* ── database ─────────────────────────────────────────────────────── */

const dataDir = env.DATA_DIR || path.join(os.homedir(), ".novaroute");
const dbFile = path.join(dataDir, "db", "data.sqlite");

let db = null;
if (fs.existsSync(dbFile)) {
  try {
    const { DatabaseSync } = await import("node:sqlite");
    db = new DatabaseSync(dbFile, { readOnly: true });
  } catch {
    warn(
      "db-unreadable",
      "Could not open the database (node:sqlite unavailable) — settings checks were skipped",
      "امکان باز کردن دیتابیس نبود (node:sqlite در دسترس نیست)؛ بررسی تنظیمات انجام نشد"
    );
  }
} else {
  warn("db-missing", `No database at ${dbFile} — is this the install directory?`, `دیتابیسی در ${dbFile} پیدا نشد؛ آیا این پوشهٔ نصب است؟`);
}

if (db) {
  const mode = fs.statSync(dbFile).mode & 0o777;
  if (mode & 0o007) {
    warn(
      "db-perms",
      `The database is world-readable (mode ${mode.toString(8)}) and holds provider credentials`,
      `دیتابیس برای همه قابل خواندن است (دسترسی ${mode.toString(8)}) و اعتبارنامه‌های ارائه‌دهنده‌ها در آن است`,
      { en: `chmod 600 ${dbFile}`, fa: `دستور chmod 600 ${dbFile} را اجرا کنید` }
    );
  }

  let settings = {};
  try {
    const row = db.prepare("SELECT data FROM settings WHERE id = 1").get();
    settings = row ? JSON.parse(row.data || "{}") : {};
  } catch { /* table may not exist yet */ }

  if (!settings.password) {
    critical(
      "no-password",
      "No dashboard password is stored — first-time setup was never completed",
      "هیچ رمزی برای داشبورد ذخیره نشده؛ تنظیم اولیه هرگز کامل نشده است",
      {
        en: "Open /setup and set a password now. Until you do, the instance is claimable by whoever reaches it first.",
        fa: "همین حالا /setup را باز کنید و رمز بگذارید. تا آن زمان، هر کسی زودتر برسد می‌تواند پنل را تصاحب کند.",
      }
    );
  } else {
    ok("password", "A dashboard password is set", "رمز داشبورد تنظیم شده است");
  }

  if (settings.requireLogin === false) {
    warn(
      "login-disabled",
      "requireLogin is off — the dashboard is open to anyone who can reach it locally",
      "گزینهٔ requireLogin خاموش است؛ داشبورد برای هر کسی که به‌صورت محلی دسترسی دارد باز است",
      { en: "Turn Require Login back on in Settings > Security.", fa: "در تنظیمات > امنیت، ورود اجباری را دوباره روشن کنید." }
    );
  }

  if (settings.requireApiKey === false) {
    warn(
      "gateway-open",
      "requireApiKey is off — /v1 accepts anonymous calls from loopback and private networks",
      "گزینهٔ requireApiKey خاموش است؛ مسیر /v1 درخواست‌های بدون کلید را از شبکهٔ محلی می‌پذیرد",
      {
        en: "Turn it on in Settings > Security and give each client its own key.",
        fa: "در تنظیمات > امنیت آن را روشن کنید و به هر کلاینت کلید جداگانه بدهید.",
      }
    );
  } else {
    ok("gateway-key", "The gateway requires an API key", "دروازه برای هر درخواست کلید API می‌خواهد");
  }

  if (settings.tunnelDashboardAccess === true && (settings.tunnelUrl || settings.tailscaleUrl)) {
    warn(
      "tunnel-dashboard",
      "The dashboard is reachable through the public tunnel URL",
      "داشبورد از طریق آدرس عمومی تونل هم در دسترس است",
      { en: "Turn off tunnel dashboard access unless you need it.", fa: "اگر لازم ندارید، دسترسی داشبورد از تونل را ببندید." }
    );
  }

  // Agent tool policy
  try {
    const row = db.prepare("SELECT value FROM kv WHERE namespace = 'novaTools' AND key = 'policy'").get();
    const policy = row ? JSON.parse(row.value || "{}") : {};
    if (policy.autoApproveReadOnly === false) {
      ok("agent-approval", "Every agent command needs admin approval", "هر دستور عامل نیاز به تأیید مدیر دارد");
    } else {
      ok(
        "agent-approval",
        "Read-only agent commands run unattended (strictly classified; everything else waits for approval)",
        "دستورهای فقط-خواندنی عامل بدون تأیید اجرا می‌شوند (با طبقه‌بندی سخت‌گیرانه؛ بقیه منتظر تأیید می‌مانند)"
      );
    }
  } catch { /* namespace not present */ }

  // Plain-text credentials still on disk
  try {
    const rows = db.prepare("SELECT data FROM providerConnections").all();
    let plaintext = 0;
    for (const r of rows) {
      try {
        const c = JSON.parse(r.data || "{}");
        for (const field of ["apiKey", "accessToken", "refreshToken", "idToken"]) {
          if (typeof c[field] === "string" && c[field] && !c[field].startsWith("enc:v1:")) plaintext++;
        }
      } catch { /* skip */ }
    }
    if (plaintext) {
      warn(
        "plaintext-credentials",
        `${plaintext} provider credential(s) are stored unencrypted`,
        `${plaintext} اعتبارنامهٔ ارائه‌دهنده بدون رمزگذاری ذخیره شده است`,
        {
          en: "Set API_KEY_SECRET, then re-save each provider so the value is rewritten encrypted.",
          fa: "مقدار API_KEY_SECRET را تنظیم کنید و هر ارائه‌دهنده را دوباره ذخیره کنید تا رمزگذاری‌شده بازنویسی شود.",
        }
      );
    }
  } catch { /* table shape differs */ }

  try {
    const keys = db.prepare("SELECT COUNT(*) AS n FROM apiKeys WHERE isActive != 0").get();
    ok("api-keys", `${keys?.n ?? 0} active gateway API key(s)`, `${keys?.n ?? 0} کلید فعال برای دروازه`);
  } catch { /* table shape differs */ }

  db.close();
}

/* ── report ───────────────────────────────────────────────────────── */

const counts = {
  critical: findings.filter((f) => f.level === "critical").length,
  warning: findings.filter((f) => f.level === "warning").length,
  ok: findings.filter((f) => f.level === "ok").length,
};

if (JSON_OUT) {
  console.log(JSON.stringify({ counts, findings }, null, 2));
} else {
  const icon = { critical: "⛔", warning: "⚠️ ", ok: "✅" };
  console.log(FA ? "\n■ بررسی وضعیت امنیتی NovaRoute\n" : "\n■ NovaRoute security posture\n");
  for (const level of ["critical", "warning", "ok"]) {
    for (const f of findings.filter((x) => x.level === level)) {
      console.log(`  ${icon[level]} ${isolate(f.title)}`);
      if (f.fix) console.log(`      ↳ ${isolate(f.fix)}`);
    }
  }
  console.log(
    FA
      ? `\nخلاصه: ${counts.critical} بحرانی، ${counts.warning} هشدار، ${counts.ok} سالم\n`
      : `\nSummary: ${counts.critical} critical, ${counts.warning} warning, ${counts.ok} ok\n`
  );
}

process.exit(counts.critical > 0 ? 1 : 0);
