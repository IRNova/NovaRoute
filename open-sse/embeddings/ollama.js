// Ollama embedding provider — calls the local Ollama /api/embeddings endpoint.
// Fail-open contract: throws on any failure; the semantic cache caller catches
// and treats the cache as a miss (request proceeds normally).
import { proxyAwareFetch } from "../utils/proxyFetch.js";

/**
 * Embed text via Ollama.
 * @param {string} text
 * @param {object} opts
 * @param {string} opts.baseUrl - e.g. "http://localhost:11434"
 * @param {string} opts.model - embedding model id (e.g. "nomic-embed-text")
 * @param {number} [opts.timeoutMs]
 * @returns {Promise<number[]>}
 */
export async function ollamaEmbed(text, { baseUrl, model, timeoutMs = 10000 }) {
  const normalized = String(baseUrl || "http://localhost:11434").replace(/\/+$/, "");
  const url = `${normalized}/api/embeddings`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await proxyAwareFetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt: String(text).slice(0, 60000) }),
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`ollama embeddings ${res.status} ${res.statusText}`);
    }
    const data = await res.json();
    const embedding = data?.embedding;
    if (!Array.isArray(embedding) || embedding.length === 0) {
      throw new Error("ollama embeddings: missing embedding vector");
    }
    return embedding;
  } finally {
    clearTimeout(timer);
  }
}
