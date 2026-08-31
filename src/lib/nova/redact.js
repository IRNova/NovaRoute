// Nova Bot — PII redaction (Hermes redact-style).
// Strips secrets and personal data from strings before they hit logs,
// audit trails, or approval previews. Fail-open: never throws.

const PATTERNS = [
  { kind: "api-key", re: /\b(sk-[A-Za-z0-9_-]{16,}|ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|xox[bap]-[A-Za-z0-9-]{10,}|AIza[A-Za-z0-9_-]{30,}|eyJhbGciOi[A-Za-z0-9_.-]{20,})/g },
  { kind: "email", re: /\b[\w.%+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g },
  { kind: "phone", re: /(?:\+98|0|98)?9\d{2}[-\s]?\d{3}[-\s]?\d{4}\b/g },
  { kind: "card", re: /\b(?:\d[ -]?){13,19}\b/g },
  { kind: "iban", re: /\bIR\d{2}(?:[ -]?[A-Z0-9]{4}){4,6}\b/gi },
  { kind: "national-id", re: /\b\d{3}[-\s]?\d{6}[-\s]?\d\b/g },
];

export function redactText(text) {
  let out = String(text ?? "");
  if (!out) return "";
  for (const { kind, re } of PATTERNS) {
    out = out.replace(re, (match) => {
      // Keep plausible non-PII short numbers like versions/dates intact:
      const digits = match.replace(/\D/g, "");
      if ((kind === "card" || kind === "national-id" || kind === "phone") && digits.length < 8) return match;
      if (kind === "national-id") {
        try {
          const d = digits.split("").map(Number);
          if (d.length !== 10) return match;
          const check = d.slice(0, 9).reduce((acc, n, i) => acc + n * (10 - i), 0) % 11;
          const valid = check < 2 ? d[9] === check : d[9] === 11 - check;
          if (!valid) return match; // not a real national id
        } catch { return match; }
      }
      return `[REDACTED:${kind}]`;
    });
  }
  return out;
}

export function redactDeep(value) {
  if (typeof value === "string") return redactText(value);
  if (Array.isArray(value)) return value.map(redactDeep);
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = redactDeep(v);
    return out;
  }
  return value;
}
