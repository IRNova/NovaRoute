// Task-type detection for adaptive routing.
// Heuristic, stateless, fail-safe: worst case returns { type: "general", confidence: 0 }.
import { TASK_TYPES } from "../config/routingConfig.js";

const CODING_TOOLS = new Set([
  "bash", "shell", "terminal", "zsh", "powershell", "cmd", "sh",
  "write", "edit", "text_editor", "apply_patch", "replace_file_content",
  "create_file", "str_replace_editor", "multi_tool_use.parallel", "notebook",
  "file_edit", "workspace", "code", "execute_command", "read_file",
]);

const AGENTIC_TOOLS = new Set([
  "web_search", "websearch", "search", "browser", "navigate", "click",
  "mcp__", "fetch_url", "http_request", "tavily", "exa", "github",
  "todo", "plan", "subagent", "task", "code_signer",
]);

const CODE_KEYWORDS = [
  "code", "function", "class", "api", "component", "implementation",
  "typescript", "javascript", "python", "rust", "go lang", "golang",
  "the code", "this file", "the repo", "the repository",
];

const REFACTOR_KEYWORDS = [
  "refactor", "refactoring", "rewrite", "rewriting", "clean up", "cleanup",
  "simplif", "modernize", "migrate", "restructure", "reorganize", "extract",
  "split this", "improve the structure", "rearchitect",
];

const DEBUG_KEYWORDS = [
  "debug", "bug", "failing", "failure", "crash", "stack trace",
  "exception", "error message", "broken", "not working", "doesn't work",
  "does not work", "traceback", "panic", "segfault", "why is this",
  "why does this", "why do i get", "the error", "an error",
];

const EXPLAIN_KEYWORDS = [
  "explain", "what is", "what are", "how does", "how do", "why does",
  "walk me through", "describe", "meaning of", "explain this code",
  "tell me about", "what's the difference", "understand this",
];

const CREATIVE_KEYWORDS = [
  "write a story", "poem", "poetry", "brainstorm", "ideas for",
  "marketing", "ad copy", "tagline", "creative", "story about",
  "song lyrics", "novel", "script for",
];

const ANALYSIS_KEYWORDS = [
  "summarize", "summarise", "analy", "compare", "contrast", "review this",
  "evaluate", "synthesize", "synthesise", "assess", "critique",
];

const DATA_KEYWORDS = [
  "sql", "csv", "dataframe", "pandas", "query the", "json data",
  "database schema", "transform this data", "parse this",
];

const TRANSLATION_KEYWORDS = [
  "translate", "translation", "translate this", "translate to",
  "in persian", "in english", "in german", "in french", "in arabic",
  "به فارسی", "ترجمه", "ترجمه کن", "به انگلیسی", "به عربی",
];

function collectMessages(body) {
  const out = [];
  const msgs = Array.isArray(body?.messages)
    ? body.messages
    : Array.isArray(body?.input)
      ? body.input
      : Array.isArray(body?.contents)
        ? body.contents
        : [];
  for (const m of msgs) {
    if (!m) continue;
    if (typeof m.content === "string") {
      out.push({ role: m.role, text: m.content });
    } else if (Array.isArray(m.content)) {
      for (const b of m.content) {
        if (!b) continue;
        if (typeof b.text === "string") out.push({ role: m.role, text: b.text });
        if (typeof b.thinking === "string") out.push({ role: m.role, text: b.thinking });
      }
    } else if (Array.isArray(m.parts)) {
      for (const p of m.parts) {
        if (p && typeof p.text === "string") out.push({ role: m.role, text: p.text });
      }
    }
  }
  return out;
}

function countOccurrences(haystack, needles) {
  let n = 0;
  for (const needle of needles) n += haystack.split(needle.toLowerCase()).length - 1;
  return n;
}

/**
 * Detect the task type of a chat request.
 * @param {object} body - Client request body (any format: messages/input/contents).
 * @returns {{ type: string, confidence: number, signals: string[] }}
 */
export function detectTaskType(body) {
  if (!body || typeof body !== "object") {
    return { type: TASK_TYPES.GENERAL, confidence: 0, signals: [] };
  }

  const signals = [];
  const messages = collectMessages(body);
  const rawMessages = Array.isArray(body.messages)
    ? body.messages
    : Array.isArray(body.input)
      ? body.input
      : Array.isArray(body.contents)
        ? body.contents
        : [];
  const tools = Array.isArray(body.tools) ? body.tools : [];
  const toolNames = new Set();
  for (const t of tools) {
    const name = t?.function?.name || t?.name || t?.id || "";
    toolNames.add(name);
  }

  const toolCallsInHistory = rawMessages.filter(
    (m) => m?.role === "assistant" && /tool_use|tool_calls|function_call/i.test(JSON.stringify(m || {}))
  ).length;
  const toolResultsInHistory = rawMessages.filter(
    (m) => m?.role === "tool" || m?.role === "function"
  ).length;

  // Joined lowercase text of all messages (content only, excluding tool results noise).
  const allText = messages.map((m) => m.text || "").join("\n").toLowerCase();
  const lastUserText = [...messages].reverse().find((m) => m.role === "user")?.text || "";
  const lastUserLower = lastUserText.toLowerCase();
  const hasCodeBlock = /```|```[\w+-]*/.test(lastUserText);

  // Agentic: heavy tool usage, tool_choice set, or parallel tooling in history.
  if (body.tool_choice || toolCallsInHistory >= 2 || toolResultsInHistory >= 3 || [...toolNames].some((n) => AGENTIC_TOOLS.has(n))) {
    signals.push(`agentic tools:${[...toolNames].slice(0, 4).join(",")} calls:${toolCallsInHistory} results:${toolResultsInHistory}`);
    return { type: TASK_TYPES.AGENTIC, confidence: 0.9, signals };
  }

  const hasCodingTools = [...toolNames].some((n) => CODING_TOOLS.has(n));
  const codeKeywordHits = countOccurrences(allText, CODE_KEYWORDS);

  if (hasCodingTools || codeKeywordHits >= 2 || hasCodeBlock) {
    signals.push(`coding context tools:${hasCodingTools} kw:${codeKeywordHits}`);
    const refactorHits = countOccurrences(lastUserLower, REFACTOR_KEYWORDS);
    if (refactorHits > 0) {
      signals.push(`refactor kw:${refactorHits}`);
      return { type: TASK_TYPES.REFACTOR, confidence: 0.85, signals };
    }
    const debugHits = countOccurrences(lastUserLower, DEBUG_KEYWORDS);
    if (debugHits > 0) {
      signals.push(`debug kw:${debugHits}`);
      return { type: TASK_TYPES.DEBUG, confidence: 0.85, signals };
    }
    return { type: TASK_TYPES.CODING, confidence: 0.8, signals };
  }

  if (countOccurrences(lastUserLower, DEBUG_KEYWORDS) > 0) {
    signals.push("debug kw");
    return { type: TASK_TYPES.DEBUG, confidence: 0.7, signals };
  }
  if (countOccurrences(lastUserLower, REFACTOR_KEYWORDS) > 0) {
    signals.push("refactor kw");
    return { type: TASK_TYPES.REFACTOR, confidence: 0.7, signals };
  }
  if (countOccurrences(lastUserLower, DATA_KEYWORDS) > 0) {
    signals.push("data kw");
    return { type: TASK_TYPES.DATA, confidence: 0.7, signals };
  }
  if (countOccurrences(lastUserLower, EXPLAIN_KEYWORDS) > 0) {
    signals.push("explain kw");
    return { type: TASK_TYPES.EXPLANATION, confidence: 0.75, signals };
  }
  if (countOccurrences(lastUserLower, CREATIVE_KEYWORDS) > 0) {
    signals.push("creative kw");
    return { type: TASK_TYPES.CREATIVE, confidence: 0.7, signals };
  }
  if (countOccurrences(lastUserLower, ANALYSIS_KEYWORDS) > 0) {
    signals.push("analysis kw");
    return { type: TASK_TYPES.ANALYSIS, confidence: 0.7, signals };
  }
  if (countOccurrences(lastUserLower, TRANSLATION_KEYWORDS) > 0) {
    signals.push("translation kw");
    return { type: TASK_TYPES.TRANSLATION, confidence: 0.8, signals };
  }

  // Simple: one short user message, no tools, no history.
  if (messages.length === 1 && lastUserLower.length > 0 && lastUserLower.length < 120 && tools.length === 0) {
    signals.push("short single turn");
    return { type: TASK_TYPES.SIMPLE, confidence: 0.65, signals };
  }

  return { type: TASK_TYPES.GENERAL, confidence: 0.2, signals };
}
