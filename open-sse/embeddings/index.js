// Abstract embedding provider interface.
// Providers self-register via registerEmbeddingProvider(); resolveEmbeddingProvider
// selects one by settings. All embedding calls must be fail-open at the caller
// (cache is an optimization — an embedding failure must never break a request).
import { ollamaEmbed } from "./ollama.js";

const providers = new Map();

export function registerEmbeddingProvider(name, impl) {
  providers.set(name, impl);
}

export function getEmbeddingProvider(name) {
  return providers.get(name) || null;
}

export function listEmbeddingProviders() {
  return [...providers.keys()];
}

// Built-in providers (more can register later — e.g. OpenAI/Transformers.js).
registerEmbeddingProvider("ollama", {
  label: "Ollama",
  embed: ollamaEmbed,
});

/**
 * Resolve the active embedding provider from settings.
 * @returns {null | { name: string, impl: object }}
 */
export function resolveEmbeddingProvider(settings = {}) {
  const cache = settings.semanticCache || {};
  const name = cache.embeddingProvider || "ollama";
  const impl = getEmbeddingProvider(name);
  if (!impl) return null;
  return { name, impl };
}

/**
 * Compute an embedding vector for text using the configured provider/settings.
 * Throws on failure — callers must catch and fail-open.
 * @param {string} text
 * @param {object} settings
 * @returns {Promise<number[]>}
 */
export async function embed(text, settings = {}) {
  const cache = settings.semanticCache || {};
  const resolved = resolveEmbeddingProvider(settings);
  if (!resolved) throw new Error(`embedding provider "${cache.embeddingProvider || "ollama"}" not available`);
  return resolved.impl.embed(text, {
    baseUrl: cache.ollamaBaseUrl || "http://localhost:11434",
    model: cache.embeddingModel || "nomic-embed-text",
    timeoutMs: cache.embeddingTimeoutMs || 10000,
  });
}
