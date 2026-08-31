/**
 * A2A Skill: Provider Discovery
 * 
 * Discovers and lists available providers and their capabilities.
 */

async function executeProviderDiscovery(task) {
  const messages = task.input.messages;
  const query = messages.map(m => m.content).join(' ').toLowerCase();

  // Discover providers from the registry
  let providers = [];
  try {
    const registryPath = require('path').join(__dirname, '../../../../open-sse/providers/registry');
    const fs = require('fs');
    if (fs.existsSync(registryPath)) {
      const files = fs.readdirSync(registryPath).filter(f => f.endsWith('.js') && f !== 'index.js');
      providers = files.map(f => ({
        id: f.replace('.js', ''),
        name: f.replace('.js', '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      }));
    }
  } catch {}

  const response = `Discovered ${providers.length} providers in the registry.\n\n` +
    `Available providers (first 20):\n${providers.slice(0, 20).map(p => `- ${p.name} (${p.id})`).join('\n')}` +
    `\n\n... and ${Math.max(0, providers.length - 20)} more.`;

  return {
    artifacts: [{ type: 'text', content: response }],
    metadata: { skill: 'provider-discovery', totalProviders: providers.length, timestamp: new Date().toISOString() },
  };
}

module.exports = { executeProviderDiscovery };
