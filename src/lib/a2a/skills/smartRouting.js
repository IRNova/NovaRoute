/**
 * A2A Skill: Smart Routing
 * 
 * Receives a prompt + metadata → routes via NovaRoute pipeline →
 * returns response with routing_explanation, cost_envelope, resilience_trace, policy_verdict.
 */

const NOVAROUTE_BASE_URL = process.env.NEXTAUTH_URL || process.env.NOVAROUTE_BASE_URL || 'http://localhost:20126';
const NOVAROUTE_API_KEY = process.env.NOVAROUTE_API_KEY || '';

async function routeFetch(path, options = {}) {
  const url = `${NOVAROUTE_BASE_URL}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(NOVAROUTE_API_KEY ? { Authorization: `Bearer ${NOVAROUTE_API_KEY}` } : {}),
  };
  const res = await fetch(url, { ...options, headers, signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`API [${res.status}]: ${await res.text().catch(() => 'error')}`);
  return res.json();
}

/**
 * Execute smart routing for an A2A task
 * @param {object} task
 * @returns {Promise<{ artifacts: Array, metadata: object }>}
 */
async function executeSmartRouting(task) {
  const messages = task.input.messages;
  const model = task.input.metadata?.model || 'auto';
  const combo = task.input.metadata?.combo;
  const budget = task.input.metadata?.budget;
  const role = task.input.metadata?.role;

  const start = Date.now();
  const body = { model, messages, stream: false };
  if (combo) body['x-combo'] = combo;

  const raw = await routeFetch('/v1/chat/completions', {
    method: 'POST',
    body: JSON.stringify(body),
  });

  const latencyMs = Date.now() - start;
  const content = raw?.choices?.[0]?.message?.content || '';
  const provider = raw?.provider || 'unknown';
  const actualCost = raw?.cost || 0;
  const promptTokens = raw?.usage?.prompt_tokens || 0;
  const estimatedCost = (promptTokens / 1_000_000) * 3.0;

  const withinBudget = budget ? actualCost <= budget : true;

  return {
    artifacts: [{ type: 'text', content }],
    metadata: {
      routing_explanation: `Selected ${raw?.model || model} via provider "${provider}" (latency: ${latencyMs}ms, cost: $${actualCost.toFixed(4)})`,
      cost_envelope: {
        estimated: Math.round(estimatedCost * 10000) / 10000,
        actual: Math.round(actualCost * 10000) / 10000,
        currency: 'USD',
      },
      resilience_trace: [
        { event: 'primary_selected', provider, timestamp: new Date().toISOString() },
        ...(raw?.fallbacksTriggered ? [{ event: 'fallback_needed', provider: 'secondary', timestamp: new Date().toISOString() }] : []),
      ],
      policy_verdict: {
        allowed: withinBudget,
        reason: withinBudget ? 'within budget and quota limits' : `cost $${actualCost} exceeds budget $${budget}`,
      },
    },
  };
}

module.exports = { executeSmartRouting };
