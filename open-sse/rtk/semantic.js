// Semantic compression layer (next-gen token killer).
// Sits next to the rule-based RTK pipeline: when the request is large, the
// OLDEST context blocks are summarized (LLM-backed) and replaced in-place.
// Fail-open contract (same as RTK): any error → returns null, body untouched.
//
// Deterministic fallback: when the summarizer endpoint is unreachable we still
// compress with extractKeyLines() (an information-preserving digest: headings,
// code signatures, error lines) so offline operation never loses everything.
import { MIN_COMPRESS_SIZE, RAW_CAP } from "./constants.js";

const DEFAULT_OPTIONS = {
  enabled: false,
  minChars: 120000,          // only engage for big contexts
  maxSummarizeChars: 240000, // cap the summarizer payload
  keepLast: 1,               // never summarize the most recent N user messages
  timeoutMs: 12000,
  budgetChars: 60000,        // max total chars to rewrite per request
  summarizerBaseUrl: "http://localhost:20128/v1/chat/completions",
  summarizerApiKey: "",
  summarizerModel: "gpt-5-mini",
};

// ---------------------------------------------------------------------------
// Body shape handling (OpenAI / Claude / Gemini) — mirrors rtk/index.js
// ---------------------------------------------------------------------------
function findMessages(body) {
  if (!body || typeof body !== "object") return null;
  if (Array.isArray(body.messages)) return body.messages;
  if (Array.isArray(body.input)) return body.input;
  if (Array.isArray(body.contents)) return body.contents;
  if (body.conversationState) return null; // kiro etc. — skip, handled by RTK
  return null;
}

function blockText(msg) {
  if (!msg) return null;
  if (typeof msg.content === "string") return { role: msg.role, text: msg.content };
  if (Array.isArray(msg.content)) {
    let text = "";
    for (const part of msg.content) {
      if (!part) continue;
      if (typeof part.text === "string") text += part.text + "\n";
      else if (typeof part.thinking === "string") text += part.thinking + "\n";
    }
    if (text) return { role: msg.role, text };
  }
  if (Array.isArray(msg.parts)) {
    let text = "";
    for (const part of msg.parts) {
      if (part && typeof part.text === "string") text += part.text + "\n";
    }
    if (text) return { role: msg.role, text };
  }
  return null;
}

function setBlockText(msg, text) {
  if (!msg) return;
  if (typeof msg.content === "string") {
    msg.content = text;
    return;
  }
  if (Array.isArray(msg.content)) {
    for (const part of msg.content) {
      if (part && typeof part.text === "string") { part.text = text; return; }
      if (part && typeof part.thinking === "string") { part.thinking = text; return; }
    }
    return;
  }
  if (Array.isArray(msg.parts)) {
    for (const part of msg.parts) {
      if (part && typeof part.text === "string") { part.text = text; return; }
    }
  }
}

// ---------------------------------------------------------------------------
// Deterministic digest fallback — survives offline, keeps key signals.
// ---------------------------------------------------------------------------
export function extractKeyLines(text, maxChars = 30000) {
  if (!text || typeof text !== "string") return "";
  const lines = text.split(/\r?\n/);
  const kept = [];
  let i = 0;
  const total = Math.min(lines.length, 6000); // hard cap to avoid unbounded scan
  for (; i < total; i++) {
    const line = lines[i];
    const t = line.trim();
    if (!t) continue;
    if (
      /^(#{1,4}\s|[-*]\s|def\s|class\s|func\s|function\s|const\s|let\s|var\s|export\s|import\s|interface\s|type\s|struct\s|fn\s|impl\s|Error|ERROR|FAIL|FAILED|exit\s|Usage:|SyntaxError|TypeError|Traceback|panic:|fatal:|WARN|warn)/i.test(t) ||
      /:\d+\s*$/.test(t) ||                    // line numbers
      /(https?:\/\/\S+)/.test(t) ||            // urls
      /^["']?[a-z_][\w.]*["']?\s*[:=]/.test(t) // config keys
    ) {
      kept.push(t);
    }
    if (kept.join("\n").length > maxChars) break;
  }
  const digest = kept.join("\n");
  if (!digest) return text.slice(0, Math.min(4000, maxChars)); // last resort
  return digest;
}

// ---------------------------------------------------------------------------
// LLM summarizer (fail-open). Calls the local gateway or a custom endpoint.
// ---------------------------------------------------------------------------
export async function summarizeText(text, options = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  if (!text) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs || 12000);
  try {
    const res = await fetch(opts.summarizerBaseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(opts.summarizerApiKey ? { Authorization: `Bearer ${opts.summarizerApiKey}` } : {}),
      },
      body: JSON.stringify({
        model: opts.summarizerModel,
        stream: false,
        temperature: 0.1,
        max_tokens: 4000,
        messages: [
          {
            role: "system",
            content:
              "You are a lossy-but-faithful context compactor. Compress the following conversation context into a compact summary that preserves: function/class names, error messages and stack traces, file paths, configuration keys, and any instruction the user gave. Keep it under 2000 tokens. Output only the summary, no preamble.",
          },
          { role: "user", content: text.slice(0, opts.maxSummarizeChars || 240000) },
        ],
      }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = await res.json();
    const summary = data?.choices?.[0]?.message?.content;
    return typeof summary === "string" && summary.trim() ? summary.trim() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Main hook — fail-open, body untouched on any failure.
// ---------------------------------------------------------------------------
export async function compressSemantically(body, options = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  if (!opts.enabled) return null;
  const messages = findMessages(body);
  if (!messages || messages.length === 0) return null;

  const blocks = [];
  let totalChars = 0;
  for (let i = 0; i < messages.length; i++) {
    const block = blockText(messages[i]);
    if (!block) continue;
    // Only compress bulk non-user, non-recent context (tool results + old user msgs).
    if (block.role === "user" && i >= messages.length - (opts.keepLast || 1)) continue;
    if (block.role === "assistant") continue;
    const text = block.text || "";
    if (text.length < MIN_COMPRESS_SIZE) continue; // too small to bother
    blocks.push({ index: i, role: block.role, text });
    totalChars += text.length;
  }
  if (blocks.length === 0 || totalChars < (opts.minChars || 120000)) return null;

  // Select oldest blocks within the rewrite budget (keep the tail intact).
  const targets = [];
  let budget = opts.budgetChars || 60000;
  for (const block of blocks) {
    if (budget <= 0) break;
    const take = Math.min(block.text.length, budget);
    targets.push({ ...block, take });
    budget -= take;
  }

  const joined = targets.map((t) => t.text.slice(0, t.take)).join("\n---\n");
  const summary = (await summarizeText(joined, opts)) || extractKeyLines(joined);
  if (!summary) return null;

  // Rewrite target blocks in-place: prepend compact summary, keep raw tail clip.
  let used = 0;
  let hits = 0;
  let bytesBefore = 0;
  let bytesAfter = 0;
  for (const target of targets) {
    const msg = messages[target.index];
    if (!msg) continue;
    const oldText = target.text;
    const clip = oldText.slice(target.take);
    const isLastTarget = target === targets[targets.length - 1];
    const prefix = isLastTarget
      ? `[semantic-compressed] ${summary}`
      : "[context compressed — see final summary]";
    const newText = clip ? `${prefix}\n\n${clip}` : prefix;
    bytesBefore += Buffer.byteLength(oldText, "utf8");
    setBlockText(msg, newText);
    bytesAfter += Buffer.byteLength(newText, "utf8");
    hits++;
    used += oldText.length - newText.length;
  }

  return {
    applied: hits > 0,
    hits,
    bytesBefore,
    bytesAfter,
    savedBytes: bytesBefore - bytesAfter,
    summarizedChars: used,
    llmBacked: summary !== (targets.length ? extractKeyLines(targets.map((t) => t.text.slice(0, t.take)).join("\n---\n")) : null),
  };
}

/** Human-readable summary line for logs. */
export function formatSemanticLog(stats) {
  if (!stats || !stats.applied) return "";
  const llm = stats.llmBacked ? "LLM" : "det";
  return `SEMANTIC:${llm} ${stats.hits}block · ${(stats.summarizedChars / 1000).toFixed(1)}k chars → ${(stats.savedBytes / 1024).toFixed(1)}KB`;
}
