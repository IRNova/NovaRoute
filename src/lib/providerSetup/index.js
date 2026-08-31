// One-click "Install & Configure" engine for local + CLI providers.
// Runs a small per-provider playbook server-side and returns a step log
// the dashboard renders verbatim. Every step is fail-soft: a failure
// records status:"fail" + detail and aborts dependent steps, never throws.
import { exec, spawn } from "child_process";
import { promisify } from "util";
import os from "os";
import fs from "fs";
import REGISTRY from "open-sse/providers/registry/index.js";
import { getProviderConnections, createProviderConnection, updateProviderConnection } from "@/models";

const execAsync = promisify(exec);

const IS_WIN = process.platform === "win32";
const WHICH_CMD = IS_WIN ? "where" : "which";

// CLI tools → npm package (when installable) + binary name to detect.
// `paths` are extra absolute locations probed when `which` fails (server
// installs like ~/.local/bin are often outside the service PATH).
const CLI_TOOLS = {
  claude: { bin: "claude", pkg: "@anthropic-ai/claude-code" },
  opencode: { bin: "opencode", pkg: "opencode-ai", paths: ["/usr/bin/opencode", "/usr/local/bin/opencode"] },
  "gemini-cli": { bin: "gemini", pkg: "@google/gemini-cli" },
  "devin-cli": { bin: "devin", paths: ["~/.local/bin/devin", "/usr/local/bin/devin", "/usr/bin/devin"] },
  "devin-cli-agentic": { bin: "devin", paths: ["~/.local/bin/devin", "/usr/local/bin/devin", "/usr/bin/devin"] },
};

// Registry entries whose category is "cli" but which are NOT actually
// installable server-side: commandcode is an HTTP API with a key,
// antigravity/devin-desktop are desktop apps.
const SETUP_EXCLUDED = new Set(["commandcode", "antigravity", "devin-desktop"]);

// Local runtimes with a real install/start path. Others fall back to probe+hint.
const LOCAL_RUNTIMES_SETUP = {
  "ollama-local": {
    label: "Ollama",
    bin: "ollama",
    startArgs: ["serve"],
    probePath: "/api/tags",
    install: {
      win32: "winget install -e --id Ollama.Ollama --accept-source-agreements --accept-package-agreements",
      linux: "curl -fsSL https://ollama.com/install.sh | sh",
      darwin: "curl -fsSL https://ollama.com/install.sh | sh",
    },
    docsUrl: "https://ollama.com/download",
  },
  "lm-studio-local": {
    label: "LM Studio",
    bin: "lms",
    startArgs: ["server", "start"],
    probePath: "/v1/models",
    docsUrl: "https://lmstudio.ai",
    hint: 'Install LM Studio from lmstudio.ai, then run "lms server start" once so the CLI is on PATH.',
  },
  "llamacpp-local": {
    label: "llama.cpp",
    probePath: "/v1/models",
    docsUrl: "https://github.com/ggerganov/llama.cpp#readme",
    hint: "llama-server must be started manually with a model file (e.g. llama-server -m model.gguf --port 8080).",
  },
};

// Generic local servers we can only probe + guide.
const LOCAL_HINTS = {
  vllm: { docsUrl: "https://docs.vllm.ai", hint: 'Install with "pip install vllm" then serve a model, e.g. "vllm serve <model>".' },
  xinference: { docsUrl: "https://github.com/xorbitsai/inference", hint: 'Install with "pip install xinference" then run "xinference-local".' },
  oobabooga: { docsUrl: "https://github.com/oobabooga/text-generation-webui", hint: "Download text-generation-webui and start it with its launcher; enable the OpenAI API extension." },
  triton: { docsUrl: "https://github.com/triton-inference-server/server", hint: "Triton runs via Docker: docker run --rm -p8000:8000 nvcr.io/nvidia/tritonserver:<tag>." },
  lemonade: { docsUrl: "https://lemonade-server.ai", hint: "Download the Lemonade Server installer and start the service." },
  "llama-cpp": { docsUrl: "https://github.com/ggerganov/llama.cpp", hint: "Build or install llama.cpp and start llama-server with a model file." },
  llamafile: { docsUrl: "https://github.com/Mozilla-Ocho/llamafile", hint: "Download a .llamafile binary from Hugging Face and run it directly." },
  "docker-model-runner": { docsUrl: "https://docs.docker.com/ai/model-runner/", hint: "Enable Docker Model Runner in Docker Desktop settings (Docker 4.40+)." },
};

function registryEntry(providerId) {
  return REGISTRY.find((r) => r.id === providerId) || null;
}

export function isSetupSupported(providerId) {
  if (SETUP_EXCLUDED.has(providerId)) return false;
  const entry = registryEntry(providerId);
  return !!entry && (entry.category === "cli" || entry.category === "local");
}

function expandHome(p) {
  if (typeof p !== "string") return p;
  return p.startsWith("~") ? p.replace(/^~(?=\/|$)/, os.homedir()) : p;
}

async function detectBinary(bin, extraPaths = []) {
  if (!bin) return null;
  try {
    const { stdout } = await execAsync(`${WHICH_CMD} ${bin}`, { timeout: 8000, windowsHide: true });
    const first = String(stdout || "").split(/\r?\n/)[0].trim();
    if (first) return first;
  } catch {
    // Fall through to known-path probing.
  }
  for (const p of extraPaths) {
    try {
      const abs = expandHome(p);
      fs.accessSync(abs, fs.constants.X_OK);
      return abs;
    } catch {
      // Not here — keep probing.
    }
  }
  return null;
}

async function binaryVersion(bin) {
  try {
    const { stdout } = await execAsync(`${bin} --version`, { timeout: 15000, windowsHide: true });
    return String(stdout || "").trim().split(/\r?\n/)[0];
  } catch {
    return "";
  }
}

async function npmInstallGlobal(pkg) {
  const { stdout, stderr } = await execAsync(`npm install -g ${pkg}`, {
    timeout: 600000,
    windowsHide: true,
    maxBuffer: 4 * 1024 * 1024,
  });
  const out = `${stdout || ""}${stderr || ""}`.trim();
  return out.split(/\r?\n/).slice(-3).join(" | ").slice(0, 400);
}

async function probeHttp(url, timeoutMs = 2500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json" } });
    return { ok: res.ok, status: res.status };
  } catch (err) {
    return { ok: false, error: err?.name === "AbortError" ? "timeout" : (err?.message || "unreachable") };
  } finally {
    clearTimeout(timer);
  }
}

function baseUrlFor(entry) {
  const raw = entry?.transport?.baseUrl || "";
  return String(raw)
    .replace(/\/+$/, "")
    .replace(/\/(chat\/completions|messages|completions|embeddings|api\/chat)$/, "")
    .replace(/\/v1$/, "");
}

// Prefer a genuinely free (keyless) model from the provider's live catalog —
// seed lists go stale and paid models 401 without a key.
async function pickFreeModel(providerId) {
  const entry = registryEntry(providerId);
  const seed = entry?.models?.[0]?.id;
  const url = entry?.modelsFetcher?.url;
  if (!url) return seed;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000), headers: { Accept: "application/json" } });
    if (!res.ok) return seed;
    const json = await res.json();
    const ids = (json?.data || []).map((m) => m.id).filter(Boolean);
    return ids.find((id) => String(id).endsWith("-free")) || ids[0] || seed;
  } catch {
    return seed;
  }
}

async function ensureConnection(providerId, name) {
  try {
    const connections = await getProviderConnections();
    const existing = (connections || []).find((c) => c.provider === providerId);
    if (existing) {
      // Older auto-created rows may lack a default model — patch them so the
      // connection is immediately testable.
      if (!existing.defaultModel) {
        const seed = await pickFreeModel(providerId);
        if (seed) await updateProviderConnection(existing.id, { defaultModel: seed }).catch(() => {});
      }
      return { connectionId: existing.id, created: false };
    }
    const seedModel = await pickFreeModel(providerId);
    const created = await createProviderConnection({
      provider: providerId,
      authType: "none",
      name,
      isActive: true,
      defaultModel: seedModel,
      providerSpecificData: {},
    });
    return { connectionId: created.id, created: true };
  } catch (err) {
    return { error: err.message };
  }
}

function startDetached(bin, args) {
  const child = spawn(bin, args, {
    detached: true,
    stdio: "ignore",
    shell: IS_WIN,
    windowsHide: true,
  });
  child.unref();
  return child.pid;
}

async function waitForProbe(url, attempts = 12, delayMs = 1000) {
  for (let i = 0; i < attempts; i += 1) {
    const result = await probeHttp(url, 2000);
    if (result.ok) return true;
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return false;
}

function step(id, label, status, detail = "") {
  return { id, label, status, detail };
}

/**
 * Run the full install/configure playbook for a local or CLI provider.
 * @returns {Promise<{ok:boolean, steps:Array, connectionId?:string}>}
 */
export async function runProviderSetup(providerId) {
  const entry = registryEntry(providerId);
  if (!entry || !isSetupSupported(providerId)) {
    return { ok: false, steps: [step("unsupported", "Provider", "fail", "This provider does not support one-click setup.")] };
  }

  if (entry.category === "cli") {
    return runCliSetup(providerId, entry);
  }
  return runLocalSetup(providerId, entry);
}

// NOTE: each playbook owns its steps array — the sub-functions used to
// reference the parent's `steps`, which threw ReferenceError at runtime.
async function runCliSetup(providerId, entry) {
  const steps = [];
  const push = (id, label, status, detail) => steps.push(step(id, label, status, detail));
  const tool = CLI_TOOLS[providerId] || {};
  const bin = tool.bin || providerId;

  // 1. Detect existing installation
  let path = await detectBinary(bin, tool.paths || []);
  push("detect", `Detect ${bin} CLI`, path ? "ok" : "pending", path || "not found");

  // 2. Install via npm when possible
  if (!path && tool.pkg) {
    push("install", `npm install -g ${tool.pkg}`, "running");
    try {
      const tail = await npmInstallGlobal(tool.pkg);
      push("install", `npm install -g ${tool.pkg}`, "ok", tail || "installed");
    } catch (err) {
      push("install", `npm install -g ${tool.pkg}`, "fail", String(err.message || err).slice(0, 400));
      return { ok: false, steps };
    }
    path = await detectBinary(bin);
    push("verify-bin", `Verify ${bin} on PATH`, path ? "ok" : "fail", path || "still not found after install (try reopening the terminal/panel)");
    if (!path) return { ok: false, steps };
  } else if (!path && !tool.pkg) {
    push("install", "Automatic install", "fail", `No automatic installer for this tool. Install it from the provider's site, then run setup again.`);
    return { ok: false, steps };
  }

  // 3. Version report
  const version = await binaryVersion(path || bin);
  if (version) push("version", "Version", "ok", version.slice(0, 120));

  // 4. Connection (only noAuth CLIs can be wired without a login flow)
  if (entry.noAuth) {
    const conn = await ensureConnection(providerId, "CLI");
    if (conn.error) {
      push("connection", "Create connection", "fail", conn.error);
      return { ok: false, steps };
    }
    push("connection", "Create connection", "ok", conn.created ? "created + activated" : "already exists");
  } else {
    push("connection", "Create connection", "skip", "Complete the login flow first (Connect button), the account is then stored automatically.");
  }

  return { ok: true, steps };
}

async function runLocalSetup(providerId, entry) {
  const steps = [];
  const push = (id, label, status, detail) => steps.push(step(id, label, status, detail));
  const runtime = LOCAL_RUNTIMES_SETUP[providerId];

  // Resolve probe URL: settings override > transport default
  let base = baseUrlFor(entry);
  try {
    const { getSettings } = await import("@/lib/db/repos/settingsRepo.js");
    const settings = await getSettings().catch(() => null);
    const override = settings?.localFirst?.runtimeUrls?.[runtimeKey(providerId)];
    if (override) base = String(override).replace(/\/+$/, "");
  } catch {}

  const probeUrl = `${base}${runtime?.probePath || "/v1/models"}`;

  // 1. Probe current state
  let running = (await probeHttp(probeUrl)).ok;
  push("probe", `Check service (${base})`, running ? "ok" : "pending", running ? "responding" : "not responding");

  // 2. Install when we have a real installer and the binary is missing
  if (!running && runtime) {
    const binPath = runtime.bin ? await detectBinary(runtime.bin) : null;
    if (!binPath && runtime.install) {
      const cmd = runtime.install[process.platform] || runtime.install.linux;
      if (cmd) {
        push("install", `Install ${runtime.label}`, "running", cmd);
        try {
          const { stdout, stderr } = await execAsync(cmd, { timeout: 900000, windowsHide: true, maxBuffer: 4 * 1024 * 1024 });
          push("install", `Install ${runtime.label}`, "ok", `${stdout || stderr || "done"}`.trim().split(/\r?\n/).slice(-2).join(" | ").slice(0, 400));
        } catch (err) {
          push("install", `Install ${runtime.label}`, "fail", `${String(err.message || err).slice(0, 300)} — manual installer: ${runtime.docsUrl}`);
          return { ok: false, steps };
        }
      }
    }

    // 3. Start the service when a start command exists
    if (runtime.startArgs && (await detectBinary(runtime.bin))) {
      push("start", `Start ${runtime.label} service`, "running");
      try {
        const pid = startDetached(runtime.bin, runtime.startArgs);
        running = await waitForProbe(probeUrl, 15, 1000);
        push("start", `Start ${runtime.label} service`, running ? "ok" : "fail", running ? `running (pid ${pid})` : "service did not become ready in time");
      } catch (err) {
        push("start", `Start ${runtime.label} service`, "fail", String(err.message || err).slice(0, 300));
      }
    } else if (!running) {
      push("start", "Start service", runtime?.hint ? "fail" : "skip", runtime?.hint || "no start command available");
    }

    // Re-probe after install/start attempts
    if (!running) running = (await probeHttp(probeUrl)).ok;
  }

  // 4. Verify
  push("verify", "Verify endpoint", running ? "ok" : "fail", running ? probeUrl : `endpoint unreachable: ${probeUrl}`);

  // 5. Connection only makes sense when the backend is actually up
  if (running) {
    const conn = await ensureConnection(providerId, "Local");
    if (conn.error) {
      push("connection", "Create connection", "fail", conn.error);
      return { ok: false, steps };
    }
    push("connection", "Create connection", "ok", conn.created ? "created + activated" : "already exists");
    return { ok: true, steps, connectionId: conn.connectionId };
  }

  if (!runtime) {
    const hint = LOCAL_HINTS[providerId];
    if (hint) push("hint", "How to install", "fail", `${hint.hint} Docs: ${hint.docsUrl}`);
  }
  return { ok: false, steps };
}

function runtimeKey(providerId) {
  if (providerId === "ollama-local") return "ollama";
  if (providerId === "lm-studio-local") return "lm-studio";
  if (providerId === "llamacpp-local") return "llamacpp";
  return providerId;
}

/**
 * Non-mutating status snapshot for the panel.
 */
export async function getSetupStatus(providerId) {
  const entry = registryEntry(providerId);
  if (!entry || !isSetupSupported(providerId)) {
    return { supported: false };
  }

  const status = {
    supported: true,
    category: entry.category,
    name: entry.display?.name || providerId,
    docsUrl: LOCAL_RUNTIMES_SETUP[providerId]?.docsUrl || LOCAL_HINTS[providerId]?.docsUrl || entry.display?.website || null,
    hint: LOCAL_RUNTIMES_SETUP[providerId]?.hint || LOCAL_HINTS[providerId]?.hint || null,
  };

  try {
    const connections = await getProviderConnections();
    const conn = (connections || []).find((c) => c.provider === providerId);
    status.connectionExists = !!conn;
    status.connectionActive = conn ? conn.isActive !== false : false;
  } catch {
    status.connectionExists = false;
  }

  if (entry.category === "cli") {
    const tool = CLI_TOOLS[providerId] || {};
    const bin = tool.bin || providerId;
    const path = await detectBinary(bin);
    status.installed = !!path;
    status.binary = bin;
    status.path = path || "";
    status.installable = !!tool.pkg;
    if (path) status.version = await binaryVersion(path);
    return status;
  }

  const runtime = LOCAL_RUNTIMES_SETUP[providerId];
  let base = baseUrlFor(entry);
  try {
    const { getSettings } = await import("@/lib/db/repos/settingsRepo.js");
    const settings = await getSettings().catch(() => null);
    const override = settings?.localFirst?.runtimeUrls?.[runtimeKey(providerId)];
    if (override) base = String(override).replace(/\/+$/, "");
  } catch {}
  const probeUrl = `${base}${runtime?.probePath || "/v1/models"}`;
  const result = await probeHttp(probeUrl);
  status.running = result.ok;
  status.baseUrl = base;
  status.probeUrl = probeUrl;
  if (result.ok && providerId === "ollama-local") {
    try {
      const res = await fetch(`${base}/api/tags`);
      const json = await res.json();
      status.models = (json?.models || []).length;
    } catch {}
  }
  return status;
}
