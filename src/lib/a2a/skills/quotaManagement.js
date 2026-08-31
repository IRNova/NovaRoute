/**
 * A2A Skill: Quota Management
 * 
 * Answers natural-language queries about provider quotas.
 */

const fs = require('fs');
const path = require('path');

async function executeQuotaManagement(task) {
  const messages = task.input.messages;
  const query = messages.map(m => m.content).join(' ').toLowerCase();

  // Read provider data
  let providerData = [];
  try {
    const dataDir = process.env.DATA_DIR || path.join(require('os').homedir(), '.novaroute');
    const providersPath = path.join(dataDir, 'providers.json');
    if (fs.existsSync(providersPath)) {
      providerData = JSON.parse(fs.readFileSync(providersPath, 'utf8'));
    }
  } catch {}

  let response = '';

  if (query.includes('ranking') || query.includes('most quota') || query.includes('best')) {
    // Rank providers by remaining quota
    const ranked = providerData
      .filter(p => p.quota !== undefined)
      .sort((a, b) => (b.quota?.remaining || 0) - (a.quota?.remaining || 0))
      .slice(0, 10);
    
    response = ranked.length > 0
      ? `Top providers by remaining quota:\n${ranked.map((p, i) => `${i + 1}. ${p.name || p.id}: ${p.quota?.remaining || 'unknown'} requests remaining`).join('\n')}`
      : 'No quota data available. Configure provider quotas in the dashboard.';
  } else if (query.includes('free') || query.includes('suggest')) {
    // Suggest free providers
    const freeProviders = providerData.filter(p => p.pricing === 'free' || p.tier === 'free');
    response = freeProviders.length > 0
      ? `Free providers available:\n${freeProviders.map(p => `- ${p.name || p.id}: ${p.models?.length || 0} models`).join('\n')}`
      : 'No free providers configured. Check the Providers page for free-tier options.';
  } else {
    // Full quota summary
    const total = providerData.length;
    const withQuota = providerData.filter(p => p.quota).length;
    const lowQuota = providerData.filter(p => p.quota?.remaining < 100).length;

    response = `Provider Quota Summary:\n- Total providers: ${total}\n- With quota tracking: ${withQuota}\n- Low quota warning: ${lowQuota}\n\nAsk about "ranking" for provider rankings, or "free" for free alternatives.`;
  }

  return {
    artifacts: [{ type: 'text', content: response }],
    metadata: { skill: 'quota-management', timestamp: new Date().toISOString() },
  };
}

module.exports = { executeQuotaManagement };
