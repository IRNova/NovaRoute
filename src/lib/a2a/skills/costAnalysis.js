/**
 * A2A Skill: Cost Analysis
 * 
 * Analyzes token usage and costs across providers.
 */

async function executeCostAnalysis(task) {
  const messages = task.input.messages;
  const query = messages.map(m => m.content).join(' ').toLowerCase();

  // Get usage data
  let usageData = { totalTokens: 0, totalCost: 0, byProvider: {} };
  try {
    const fs = require('fs');
    const path = require('path');
    const dataDir = process.env.DATA_DIR || path.join(require('os').homedir(), '.novaroute');
    const usagePath = path.join(dataDir, 'usage.json');
    if (fs.existsSync(usagePath)) {
      usageData = JSON.parse(fs.readFileSync(usagePath, 'utf8'));
    }
  } catch {}

  const response = `Cost Analysis:\n- Total tokens used: ${usageData.totalTokens?.toLocaleString() || '0'}\n- Total cost: $${(usageData.totalCost || 0).toFixed(4)}\n- Providers used: ${Object.keys(usageData.byProvider || {}).length}\n\n` +
    `Provider breakdown:\n${Object.entries(usageData.byProvider || {}).map(([k, v]) => `- ${k}: ${v.tokens?.toLocaleString() || 0} tokens, $${(v.cost || 0).toFixed(4)}`).join('\n') || 'No usage data yet.'}`;

  return {
    artifacts: [{ type: 'text', content: response }],
    metadata: { skill: 'cost-analysis', timestamp: new Date().toISOString() },
  };
}

module.exports = { executeCostAnalysis };
