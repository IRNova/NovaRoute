import { execFile } from "child_process";
import { promisify } from "util";

const execAsync = promisify(execFile);

const TMUX_PREFIX = "nrlg_";

// Per-provider interactive login commands, run inside a tmux session so the
// dashboard can relay URLs/prompts and inject the user's responses.
export const CLI_LOGIN_COMMANDS = {
  "devin-cli": "devin auth login --force-manual-token-flow",
  "devin-cli-agentic": "devin auth login --force-manual-token-flow",
  claude: "claude setup-token",
  "gemini-cli": "NO_BROWSER=1 gemini",
  commandcode: "commandcode login",
};

const PATH_PREPEND = "export PATH=$PATH:/root/.local/bin:/root/.local/share/devin/bin:/usr/local/bin:/usr/bin";

function sanitize(providerId) {
  return String(providerId || "").replace(/[^a-z0-9-]/gi, "");
}

function sessionName(providerId) {
  return `${TMUX_PREFIX}${sanitize(providerId)}`;
}

async function tmux(args, timeoutMs = 8000) {
  const { stdout } = await execAsync("tmux", args, { timeout: timeoutMs, windowsHide: true });
  return stdout;
}

export function isLoginSupported(providerId) {
  return !!CLI_LOGIN_COMMANDS[providerId];
}

export async function hasTmux() {
  try {
    await execAsync("tmux", ["-V"], { timeout: 5000, windowsHide: true });
    return true;
  } catch {
    return false;
  }
}

export async function loginSessionActive(providerId) {
  try {
    const out = await tmux(["list-sessions", "-F", "#{session_name}"]);
    return out.split("\n").includes(sessionName(providerId));
  } catch {
    return false;
  }
}

export async function startLogin(providerId) {
  if (!isLoginSupported(providerId)) {
    return { ok: false, error: "No interactive login flow registered for this provider" };
  }
  if (!(await hasTmux())) {
    return { ok: false, error: "tmux is not available on the server" };
  }
  await stopLogin(providerId);
  const cmd = CLI_LOGIN_COMMANDS[providerId];
  await tmux(["new-session", "-d", "-s", sessionName(providerId), "-x", "180", "-y", "40", `${PATH_PREPEND}; ${cmd}`]);
  // Give the CLI a moment to paint its first screen.
  await new Promise((r) => setTimeout(r, 1500));
  return { ok: true, session: sessionName(providerId) };
}

export async function readScreen(providerId) {
  if (!(await loginSessionActive(providerId))) return { active: false, screen: "" };
  try {
    const screen = await tmux(["capture-pane", "-t", sessionName(providerId), "-p", "-S", "-300"]);
    return { active: true, screen: screen.replace(/\n{3,}/g, "\n\n").trimEnd() };
  } catch {
    return { active: false, screen: "" };
  }
}

// Literal text injection (no key-name interpretation), then Enter separately
// so arbitrary pasted codes/URLs stay safe.
export async function sendInput(providerId, text) {
  if (!(await loginSessionActive(providerId))) {
    return { ok: false, error: "No active login session" };
  }
  const target = sessionName(providerId);
  await tmux(["send-keys", "-t", target, "-l", "--", String(text ?? "")]);
  await tmux(["send-keys", "-t", target, "Enter"]);
  await new Promise((r) => setTimeout(r, 1200));
  return { ok: true };
}

export async function sendKey(providerId, keyName) {
  const allowed = new Set(["Enter", "Escape", "Space", "Up", "Down", "Left", "Right", "Tab", "BSpace", "C-c"]);
  if (!allowed.has(keyName)) return { ok: false, error: "Key not allowed" };
  if (!(await loginSessionActive(providerId))) return { ok: false, error: "No active login session" };
  await tmux(["send-keys", "-t", sessionName(providerId), keyName]);
  await new Promise((r) => setTimeout(r, 800));
  return { ok: true };
}

export async function stopLogin(providerId) {
  try {
    await tmux(["kill-session", "-t", sessionName(providerId)]);
  } catch {
    // Session may not exist — nothing to stop.
  }
  return { ok: true };
}
