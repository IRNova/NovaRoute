import { NextResponse } from "next/server";
import { getAdapter } from "@/lib/db/driver.js";
import { parseJson } from "@/lib/db/helpers/jsonCol.js";
import { getProviderConnections } from "@/lib/db/repos/connectionsRepo.js";
import { getSettings } from "@/lib/db/repos/settingsRepo.js";
import { getCapabilitiesForModel } from "open-sse/providers/capabilities.js";

export const dynamic = "force-dynamic";

const DEFAULT_CONTEXT_WINDOW = 4096;
const MODEL_TOKEN_LIMITS = {
  openai: {
    "gpt-4o": 128000,
    "gpt-4-turbo": 128000,
    "gpt-4": 8192,
    "gpt-4-32k": 32768,
    "gpt-3.5-turbo": 16384,
    "o1": 200000,
    "o1-mini": 128000,
    "o1-pro": 200000,
    "o3": 200000,
    "o3-mini": 200000,
    "o4-mini": 200000,
    "gpt-4.1": 1047576,
    "gpt-4.1-mini": 1047576,
    "gpt-4.1-nano": 1047576,
    "gpt-5": 400000,
    "gpt-5-mini": 400000,
    "gpt-5-nano": 400000,
    "gpt-5.6-sol": 400000,
  },
  anthropic: {
    "claude-sonnet-4": 200000,
    "claude-opus-4": 200000,
    "claude-3.5-sonnet": 200000,
    "claude-3-haiku": 200000,
    "claude-3-opus": 200000,
    "claude-3-sonnet": 200000,
  },
  google: {
    "gemini-2.5-pro": 1048576,
    "gemini-2.5-flash": 1048576,
    "gemini-2.0-flash": 1048576,
    "gemini-2.0-pro": 1048576,
    "gemini-1.5-pro": 2097152,
    "gemini-1.5-flash": 1048576,
  },
  deepseek: {
    "deepseek-chat": 65536,
    "deepseek-reasoner": 65536,
  },
  mistral: {
    "mistral-large": 131072,
    "mistral-medium": 32768,
    "mistral-small": 32768,
  },
  groq: {
    "llama-3.3-70b": 131072,
    "llama-4-scout": 524288,
    "llama-4-maverick": 524288,
    "mixtral-8x7b": 32768,
  },
  xai: {
    "grok-3": 131072,
    "grok-3-mini": 131072,
    "grok-2": 131072,
  },
};

function getTokenLimit(provider, modelId) {
  try {
    const caps = getCapabilitiesForModel(provider, modelId);
    if (caps?.contextWindow && caps.contextWindow > 0) {
      return caps.contextWindow;
    }
  } catch {}

  const providerLimits = MODEL_TOKEN_LIMITS[provider];
  if (providerLimits) {
    for (const [pattern, limit] of Object.entries(providerLimits)) {
      if (modelId === pattern || modelId.startsWith(pattern + "-") || modelId.startsWith(pattern + "_")) {
        return limit;
      }
    }
  }

  return 0;
}

function getDateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getNextResetTime(resetHour = 0) {
  const now = new Date();
  const next = new Date(now);
  next.setHours(resetHour, 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next.toISOString();
}

export async function GET() {
  try {
    const db = await getAdapter();
    const settings = await getSettings();
    const resetHour = settings?.modelTokenResetHour ?? 0;

    const connections = await getProviderConnections();
    const activeProviders = new Map();
    for (const conn of connections) {
      if (conn.isActive === false || conn.testStatus === "error") continue;
      const existing = activeProviders.get(conn.provider);
      if (!existing || (conn.testStatus === "active" || conn.testStatus === "success")) {
        activeProviders.set(conn.provider, conn);
      }
    }

    const todayKey = getDateKey(new Date());
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayKey = getDateKey(yesterday);

    const usageRows = db.all(
      `SELECT data FROM usageDaily WHERE dateKey IN (?, ?)`,
      [todayKey, yesterdayKey]
    );

    const todayUsage = {};
    for (const row of usageRows) {
      const dayData = parseJson(row.data, {});
      if (!dayData.byModel) continue;

      for (const [modelKey, stats] of Object.entries(dayData.byModel)) {
        const parts = modelKey.split("|");
        const modelName = parts[0];
        const modelProvider = parts[1] || "unknown";
        const totalTokens = (stats.promptTokens || 0) + (stats.completionTokens || 0);

        if (!todayUsage[modelKey]) {
          todayUsage[modelKey] = {
            model: modelName,
            provider: modelProvider,
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
            requests: 0,
            cost: 0,
          };
        }
        todayUsage[modelKey].promptTokens += stats.promptTokens || 0;
        todayUsage[modelKey].completionTokens += stats.completionTokens || 0;
        todayUsage[modelKey].totalTokens += totalTokens;
        todayUsage[modelKey].requests += stats.requests || 0;
        todayUsage[modelKey].cost += stats.cost || 0;
      }
    }

    const recentRows = db.all(
      `SELECT DISTINCT model, provider FROM usageHistory WHERE timestamp >= datetime('now', '-7 days') ORDER BY timestamp DESC`
    );

    const connectedModels = new Map();
    for (const row of recentRows) {
      if (!row.model) continue;
      const provider = row.provider || "unknown";
      const key = `${row.model}|${provider}`;
      if (!connectedModels.has(key)) {
        connectedModels.set(key, { model: row.model, provider });
      }
    }

    const models = [];
    const seen = new Set();

    for (const [key, { model, provider }] of connectedModels) {
      if (seen.has(key)) continue;
      seen.add(key);

      const tokenLimit = getTokenLimit(provider, model);
      const usage = todayUsage[key] || {
        model, provider,
        promptTokens: 0, completionTokens: 0, totalTokens: 0, requests: 0, cost: 0,
      };

      const usagePercentage = tokenLimit > 0
        ? Math.min(100, Math.round((usage.totalTokens / tokenLimit) * 100))
        : 0;

      models.push({
        model,
        provider,
        tokenLimit,
        tokensUsed: usage.totalTokens,
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        requests: usage.requests,
        cost: usage.cost,
        usagePercentage,
        remaining: Math.max(0, tokenLimit - usage.totalTokens),
      });
    }

    models.sort((a, b) => {
      if (a.provider !== b.provider) return a.provider.localeCompare(b.provider);
      return b.usagePercentage - a.usagePercentage;
    });

    const nextReset = getNextResetTime(resetHour);

    return NextResponse.json({
      models,
      resetHour,
      nextReset,
      dateKey: todayKey,
    });
  } catch (error) {
    console.error("[API] Failed to get model token data:", error);
    return NextResponse.json({ error: "Failed to fetch model token data" }, { status: 500 });
  }
}
