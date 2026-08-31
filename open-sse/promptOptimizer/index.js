// Prompt Optimizer (Phase 5).
// Opt-in request-side hook that detects weak/vague prompts and enhances them
// before dispatch. Deterministic rewrites by default (zero latency, no cost);
// mode "full" may consult a local LLM, falling back to the deterministic path.
// Fail-open contract: any error → returns null, body untouched.
import { MIN_COMPRESS_SIZE } from "../rtk/constants.js";

const DEFAULT_OPTIONS = {
  enabled: false,
  mode: "auto",          // "auto" | "light" | "full" | "off"
  minLength: 20,         // prompts shorter than this are candidates
  timeoutMs: 8000,
  llmEndpoint: "http://localhost:20128/v1/chat/completions",
  llmApiKey: "",
  llmModel: "gpt-5-mini",
};

// ---------------------------------------------------------------------------
// Heuristic analysis — returns { score (0..1, higher = better), issues [] }
// ---------------------------------------------------------------------------
const VAGUE_RE = /^(help|how|why|what|do|write|make|fix|explain|code|solve|tell)\b/i;
const AMBIGUOUS_RE = /\b(it|this thing|that thing|them|those|some stuff)\b/i;
const CONSTRAINT_RE = /\b(in|using|with|for|within|under|less than|as|like)\b/i;

export function analyzePrompt(text) {
  if (!text || typeof text !== "string") {
    return { score: 0, issues: [{ code: "empty", label: "empty prompt" }] };
  }
  const issues = [];
  const length = text.trim().length;
  if (length === 0) issues.push({ code: "empty", label: "empty prompt" });
  if (length < 20) issues.push({ code: "too-short", label: "prompt too short" });
  if (length < 60 && VAGUE_RE.test(text.trim())) {
    issues.push({ code: "vague-intent", label: "vague intent (boilerplate verb, no detail)" });
  }
  if (AMBIGUOUS_RE.test(text) && length < 120) {
    issues.push({ code: "ambiguous-ref", label: "ambiguous pronoun without referent" });
  }
  if (!/[?؟]/.test(text) && length < 80) {
    issues.push({ code: "no-deliverable", label: "no explicit question or deliverable" });
  }
  if (!CONSTRAINT_RE.test(text)) {
    issues.push({ code: "no-constraints", label: "no constraints / context given" });
  }
  // Score: start at 1, subtract per issue.
  const score = Math.max(0, 1 - issues.length * 0.22);
  return { score, issues };
}

// ---------------------------------------------------------------------------
// Deterministic rewrite — non-destructive, flags provenance with a marker.
// ---------------------------------------------------------------------------
export function enhancePrompt(text, issues, options = {}) {
  if (!text) return null;
  const lines = [text.trim()];
  const codes = new Set((issues || []).map((i) => i.code));

  let prefix = "";
  if (codes.has("vague-intent") || codes.has("too-short") || codes.has("empty")) {
    prefix = "I need help with the following task — please be specific and thorough: ";
  }
  if (codes.has("ambiguous-ref")) {
    lines.push("(Clarification: the terms above refer to the specific subject of this request.)");
  }
  if (codes.has("no-deliverable")) {
    lines.push("Please provide a direct answer with concrete steps and a clear deliverable.");
  }
  if (codes.has("no-constraints")) {
    lines.push("State any assumptions you make, and keep the answer focused and actionable.");
  }

  const enhanced = `${prefix}${lines.join("\n")}`;
  return enhanced !== text.trim() ? enhanced : null;
}

// ---------------------------------------------------------------------------
// LLM path (mode "full") — fail-open to deterministic.
// ---------------------------------------------------------------------------
async function llmEnhance(text, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs || 8000);
  try {
    const res = await fetch(options.llmEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(options.llmApiKey ? { Authorization: `Bearer ${options.llmApiKey}` } : {}),
      },
      body: JSON.stringify({
        model: options.llmModel || "gpt-5-mini",
        stream: false,
        temperature: 0.2,
        max_tokens: 600,
        messages: [
          {
            role: "system",
            content:
              "You rewrite vague user prompts into precise, actionable ones. Keep the user's intent and all details; add specificity, constraints, and a requested output format. Output ONLY the rewritten prompt — no explanations, no quotes.",
          },
          { role: "user", content: text.slice(0, 20000) },
        ],
      }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = await res.json();
    const out = data?.choices?.[0]?.message?.content;
    return typeof out === "string" && out.trim() ? out.trim() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Main hook — operate on the last simple string user message only.
// ---------------------------------------------------------------------------
export async function optimizeMessages(body, options = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  if (!opts.enabled || opts.mode === "off") return null;
  const messages = Array.isArray(body?.messages) ? body.messages
    : Array.isArray(body?.input) ? body.input
    : null;
  if (!messages || messages.length === 0) return null;

  // Only touch the final plain-string user message (consistent with caveman
  // which mutates translatedBody; block arrays / tools / thinking skipped).
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (!msg || msg.role !== "user") continue;
    if (typeof msg.content !== "string") continue;
    const text = msg.content;
    if (text.length >= MIN_COMPRESS_SIZE) return null; // huge prompt: leave it

    const analysis = analyzePrompt(text);
    if (analysis.score >= 0.9) return null; // already good

    let rewritten = null;
    if (opts.mode === "full") {
      rewritten = await llmEnhance(text, opts);
    }
    if (!rewritten) {
      rewritten = enhancePrompt(text, analysis.issues, opts);
    }
    if (!rewritten || rewritten === text) return null;

    msg.content = rewritten;
    return {
      applied: true,
      mode: opts.mode,
      issues: analysis.issues.map((i) => i.code),
      score: analysis.score,
      originalLength: text.length,
      newLength: rewritten.length,
    };
  }
  return null;
}

/** Human-readable log line. */
export function formatOptimizerLog(stats) {
  if (!stats?.applied) return "";
  const mode = stats.mode === "full" ? "LLM" : "det";
  return `OPTIMIZER:${mode} ${stats.originalLength}→${stats.newLength} chars · issues:[${stats.issues.join(",")}]`;
}
