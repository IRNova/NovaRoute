// Dynamic adaptive fallback.
// Unlike static combo order, after each failed candidate we re-rank the
// remaining pool (cheaper / faster / higher-quota alternatives float up) so the
// next attempt adapts to live conditions instead of following a fixed list.
import { checkFallbackError, formatRetryAfter } from "../services/accountFallback.js";
import { unavailableResponse } from "../utils/error.js";
import { rankCandidates } from "./scorer.js";
import { getStatsMap } from "./predictor.js";
import { selectModels } from "./selector.js";

/**
 * Adaptive fallback loop over a ranked candidate list.
 *
 * @param {object} opts
 * @param {Array<{provider: string, model: string}>} opts.candidates - initial ranked candidates
 * @param {object} opts.body - client request body
 * @param {string} opts.taskType
 * @param {Function} opts.handleSingleModel - (body, modelStr) => Promise<Response>
 * @param {object} opts.log - logger
 * @param {object} [opts.weights]
 * @param {number} [opts.maxCandidates]
 * @returns {Promise<Response>}
 */
export async function handleAdaptiveFallback({ candidates, body, taskType, handleSingleModel, log, weights, maxCandidates = 10 }) {
  const initial = Array.isArray(candidates) ? candidates.filter(Boolean) : [];
  if (initial.length === 0) {
    log?.warn?.("ROUTE", "adaptive fallback: empty candidate pool");
    return new Response(
      JSON.stringify({ error: { message: "No routing candidates available" } }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  let remaining = initial.slice(0, maxCandidates);
  let lastError = null;
  let lastStatus = null;
  let earliestRetryAfter = null;
  let attempt = 0;
  let reRankCount = 0;

  while (remaining.length > 0) {
    const current = remaining[0];
    remaining = remaining.slice(1);
    const modelStr = `${current.provider}/${current.model}`;
    attempt++;
    log?.info?.("ROUTE", `adaptive attempt ${attempt}/${initial.length}: ${modelStr}`);

    try {
      const result = await handleSingleModel(body, modelStr);
      if (result.ok) {
        log?.info?.("ROUTE", `${modelStr} succeeded (after ${attempt - 1} failover(s), ${reRankCount} re-rank(s))`);
        return result;
      }

      let errorText = result.statusText || "";
      let retryAfter = null;
      try {
        const errorBody = await result.clone().json();
        errorText = errorBody?.error?.message || errorBody?.error || errorBody?.message || errorText;
        retryAfter = errorBody?.retryAfter || null;
      } catch {
        // ignore parse failures
      }
      if (typeof errorText !== "string") {
        try { errorText = JSON.stringify(errorText); } catch { errorText = String(errorText); }
      }
      if (retryAfter && (!earliestRetryAfter || new Date(retryAfter) < new Date(earliestRetryAfter))) {
        earliestRetryAfter = retryAfter;
      }

      const { shouldFallback, cooldownMs } = checkFallbackError(result.status, errorText);
      if (!shouldFallback) {
        log?.warn?.("ROUTE", `${modelStr} failed non-fallback ${result.status}: ${errorText}`);
        return result;
      }

      lastError = errorText || String(result.status);
      if (!lastStatus) lastStatus = result.status;
      log?.warn?.("ROUTE", `${modelStr} failed (${result.status}), adapting...`);

      // Adaptive re-rank: let the remaining pool re-order now that this
      // provider just failed and quota/network conditions may have changed.
      if (remaining.length > 1) {
        try {
          const statsMap = await getStatsMap(taskType);
          const reranked = rankCandidates(remaining, { taskType, weights, statsMap });
          if (reranked[0]?.provider + "|" + reranked[0]?.model !== remaining[0].provider + "|" + remaining[0].model) {
            log?.info?.("ROUTE", `re-ranked pool → ${reranked[0].provider}/${reranked[0].model} first`);
          }
          remaining = reranked.map((r) => ({ provider: r.provider, model: r.model }));
          reRankCount++;
        } catch {
          // keep current order on any scorer failure
        }
      }
    } catch (error) {
      lastError = error.message || String(error);
      if (!lastStatus) lastStatus = 500;
      log?.warn?.("ROUTE", `${modelStr} threw, trying next: ${lastError}`);
    }
  }

  const allDisabled = lastError && lastError.toLowerCase().includes("no credentials");
  const status = allDisabled ? 503 : (lastStatus || 503);
  const msg = lastError || "All routing candidates unavailable";
  if (earliestRetryAfter) {
    const retryHuman = formatRetryAfter(earliestRetryAfter);
    log?.warn?.("ROUTE", `all candidates failed | ${msg} (${retryHuman})`);
    return unavailableResponse(status, msg, earliestRetryAfter, retryHuman);
  }
  log?.warn?.("ROUTE", `all candidates failed | ${msg}`);
  return new Response(
    JSON.stringify({ error: { message: msg } }),
    { status, headers: { "Content-Type": "application/json" } }
  );
}

/**
 * Build an adaptive plan for a request:
 * - full smart selection for virtual models (smart/auto/best)
 * - explicit requested model first, smart pool as dynamic fallback
 * @param {object} opts
 * @returns {Promise<{taskType: string, candidates: Array<{provider, model}>|null, virtual: boolean}>}
 */
export async function buildAdaptivePlan({ body, modelStr, taskType, weights, maxCandidates }) {
  const { SMART_MODEL_NAMES } = await import("../config/routingConfig.js");
  const virtual = SMART_MODEL_NAMES.has(String(modelStr || "").toLowerCase().trim());

  if (virtual) {
    const { candidates } = await selectModels({
      body,
      taskType,
      maxCandidates,
      weights,
    });
    return { taskType, candidates, virtual: true };
  }

  // Non-virtual: keep the requested model as the lead, append the smart pool.
  const { selectModels } = await import("./selector.js");
  const smart = await selectModels({ body, taskType, maxCandidates: 3, weights }).catch(() => ({ candidates: [] }));
  const requested = modelStr.includes("/")
    ? { provider: modelStr.split("/")[0], model: modelStr.slice(modelStr.indexOf("/") + 1) }
    : null;
  const pool = [];
  const seen = new Set();
  if (requested) {
    pool.push(requested);
    seen.add(`${requested.provider}|${requested.model}`);
  }
  for (const c of smart.candidates || []) {
    const key = `${c.provider}|${c.model}`;
    if (!seen.has(key)) { pool.push({ provider: c.provider, model: c.model }); seen.add(key); }
  }
  return { taskType, candidates: pool, virtual: false };
}
