// Nova Bot — tirith-lite security layer (Hermes tirith/threat_patterns style).
// Prompt-injection heuristics + secret-leak scanning. Fail-open philosophy:
// scan results are advisory flags; hard blocks only where explicitly wired.

const INJECTION_PATTERNS = [
  { id: "override-instructions", re: /\b(ignore|disregard|forget)\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|rules?)/i },
  { id: "reveal-system", re: /\b(reveal|show|print|repeat|output)\s+(me\s+)?(your|the)\s+(system\s+prompt|initial\s+instructions?|hidden\s+rules?)/i },
  { id: "role-hijack", re: /\byou\s+are\s+now\s+(a|an)\s+/i },
  { id: "developer-mode", re: /\b(developer\s+mode|dan\s+mode|jailbreak)\b/i },
  { id: "tool-smuggle", re: /<\|im_start\|>|<\/?inst>|\[\/?INST\]|###\s*System:/i },
];

const SECRET_PATTERNS = [
  { kind: "openai", re: /\bsk-[A-Za-z0-9_-]{16,}\b/g },
  { kind: "github", re: /\b(ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})\b/g },
  { kind: "slack", re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g },
  { kind: "google", re: /\bAIza[A-Za-z0-9_-]{30,}\b/g },
  { kind: "aws", re: /\bAKIA[0-9A-Z]{16}\b/g },
];

/**
 * Scan user input for prompt-injection attempts.
 * Returns { safe: boolean, flags: string[] } — safe=false when strong hits.
 */
export function scanPrompt(text) {
  const s = String(text || "");
  if (s.length < 8) return { safe: true, flags: [] };
  const flags = [];
  for (const p of INJECTION_PATTERNS) {
    if (p.re.test(s)) flags.push(p.id);
  }
  // Huge opaque blobs are often smuggled payloads.
  const b64 = s.match(/[A-Za-z0-9+/=]{2400,}/);
  if (b64) flags.push("opaque-blob");
  return { safe: flags.length === 0, flags };
}

/** Detect hardcoded secrets inside content about to be written to disk. */
export function scanSecrets(content) {
  const s = String(content || "");
  const found = [];
  for (const p of SECRET_PATTERNS) {
    const m = s.match(p.re);
    if (m) found.push(`${p.kind}×${m.length}`);
  }
  return { clean: found.length === 0, found };
}

/** Human-readable warning line for approval previews. */
export function secretsWarning(content) {
  const r = scanSecrets(content);
  return r.clean ? "" : `⚠️ SECRETS DETECTED (${r.found.join(", ")}) — redact before approving unless intended.`;
}
