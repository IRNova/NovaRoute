// Nova Bot — context compression & auto-titling (Hermes-style).
// Keeps long conversations inside model context windows by summarizing the
// older tail, and gives sessions human-friendly titles automatically.

/**
 * Compress a transcript array into a prompt-ready string.
 * If history is short → plain join. If long → keep recent messages verbatim
 * and summarize older ones into a compact block via a cheap LLM call.
 *
 * @param {Array}  messages   [{role, agentName, content}]
 * @param {Function} callModel async (messages) => string — any available model
 * @param {object} opts { keepRecent=8, compressOver=16 }
 */
export async function buildCompressedHistory(messages, callModel, opts = {}) {
  const { keepRecent = 8, compressOver = 16 } = opts;
  const list = (messages || []).filter((m) => String(m.content || "").trim());
  if (list.length <= compressOver) {
    return list
      .map((m) => `${m.role === "user" ? "CLIENT" : m.agentName || "ASSISTANT"}: ${String(m.content).slice(0, 500)}`)
      .join("\n");
  }

  const older = list.slice(0, list.length - keepRecent);
  const recent = list.slice(-keepRecent);

  let summary = "";
  try {
    const raw = await callModel([
      {
        role: "system",
        content:
          "Summarize this conversation excerpt in under 120 words. Keep: client goals, decisions made, facts learned, open questions. Plain text only.",
      },
      {
        role: "user",
        content: older
          .map((m) => `${m.role === "user" ? "CLIENT" : m.agentName || "ASSISTANT"}: ${String(m.content).slice(0, 400)}`)
          .join("\n")
          .slice(0, 6000),
      },
    ]);
    summary = String(raw || "").trim().slice(0, 800);
  } catch {
    // Fallback: crude truncation of the oldest block.
    summary = older
      .map((m) => `${m.role === "user" ? "CLIENT" : m.agentName || "AGENT"}: ${String(m.content).slice(0, 120)}`)
      .join(" | ")
      .slice(0, 600);
  }

  return [
    `[Earlier conversation summary]\n${summary}\n[/summary]`,
    ...recent.map((m) => `${m.role === "user" ? "CLIENT" : m.agentName || "ASSISTANT"}: ${String(m.content).slice(0, 500)}`),
  ].join("\n");
}

/**
 * Generate a short session title from the first user message.
 * Returns "" on any failure (caller keeps existing title).
 */
export async function generateSessionTitle(userText, callModel) {
  try {
    const raw = await callModel([
      {
        role: "system",
        content:
          'Generate a very short conversation title (max 5 words) for this request. Reply with the title only, no quotes, no punctuation at the end.',
      },
      { role: "user", content: String(userText).slice(0, 400) },
    ]);
    return String(raw || "").replace(/^["'\s]+|["'.\s]+$/g, "").slice(0, 60);
  } catch {
    return "";
  }
}
