/**
 * Plugin Marketplace — ClawHub-style plugin discovery & management
 * 
 * Provides plugin registration, discovery, installation, and lifecycle management.
 */

const { EventEmitter } = require('events');
const crypto = require('crypto');

// ============ Plugin Categories ============

const PluginCategory = {
  PROVIDER: 'provider',
  TOOL: 'tool',
  CHANNEL: 'channel',
  AUTH: 'auth',
  ANALYTICS: 'analytics',
  SECURITY: 'security',
  UI: 'ui',
  ROUTING: 'routing',
  MEMORY: 'memory',
  VOICE: 'voice',
  OTHER: 'other',
};

// ============ Plugin Registry ============

class PluginRegistry extends EventEmitter {
  constructor() {
    super();
    /** @type {Map<string, PluginManifest>} */
    this.plugins = new Map();
    /** @type {Map<string, InstalledPlugin>} */
    this.installed = new Map();
    this._loadBuiltinPlugins();
  }

  _loadBuiltinPlugins() {
    const builtins = [
      {
        id: 'novaroute-core',
        name: 'NovaRoute Core',
        description: 'Core AI gateway functionality',
        version: '1.0.0',
        author: 'NovaRoute',
        category: PluginCategory.PROVIDER,
        tags: ['core', 'ai', 'gateway'],
        hooks: ['provider:request', 'provider:response'],
        builtin: true,
        downloads: 0,
        rating: 5.0,
        createdAt: '2026-01-01T00:00:00Z',
      },
      {
        id: 'openai-provider',
        name: 'OpenAI Provider',
        description: 'OpenAI API integration (GPT-4, DALL-E, Whisper)',
        version: '1.0.0',
        author: 'NovaRoute',
        category: PluginCategory.PROVIDER,
        tags: ['openai', 'gpt', 'dall-e', 'whisper'],
        hooks: ['provider:request'],
        builtin: true,
        downloads: 0,
        rating: 4.8,
        createdAt: '2026-01-01T00:00:00Z',
      },
      {
        id: 'anthropic-provider',
        name: 'Anthropic Provider',
        description: 'Anthropic API integration (Claude)',
        version: '1.0.0',
        author: 'NovaRoute',
        category: PluginCategory.PROVIDER,
        tags: ['anthropic', 'claude'],
        hooks: ['provider:request'],
        builtin: true,
        downloads: 0,
        rating: 4.9,
        createdAt: '2026-01-01T00:00:00Z',
      },
      {
        id: 'smart-router',
        name: 'Smart Router',
        description: 'Intelligent routing with 19 combo strategies',
        version: '1.0.0',
        author: 'NovaRoute',
        category: PluginCategory.ROUTING,
        tags: ['routing', 'combo', 'intelligent'],
        hooks: ['route:select', 'route:fallback'],
        builtin: true,
        downloads: 0,
        rating: 5.0,
        createdAt: '2026-01-01T00:00:00Z',
      },
      {
        id: 'guardrails-pro',
        name: 'Guardrails Pro',
        description: 'PII masking, prompt injection detection, credential protection',
        version: '1.0.0',
        author: 'NovaRoute',
        category: PluginCategory.SECURITY,
        tags: ['security', 'guardrails', 'pii', 'injection'],
        hooks: ['request:preprocess', 'response:postprocess'],
        builtin: true,
        downloads: 0,
        rating: 4.7,
        createdAt: '2026-01-01T00:00:00Z',
      },
      {
        id: 'gamification-engine',
        name: 'Gamification Engine',
        description: 'Badges, XP, streaks, leaderboard',
        version: '1.0.0',
        author: 'NovaRoute',
        category: PluginCategory.UI,
        tags: ['gamification', 'badges', 'xp', 'leaderboard'],
        hooks: ['user:action'],
        builtin: true,
        downloads: 0,
        rating: 4.5,
        createdAt: '2026-01-01T00:00:00Z',
      },
      {
        id: 'token-saver',
        name: 'Token Saver (RTK)',
        description: 'Reduces token usage by 20-40% via RTK compression',
        version: '1.0.0',
        author: 'NovaRoute',
        category: PluginCategory.TOOL,
        tags: ['tokens', 'compression', 'savings'],
        hooks: ['request:preprocess'],
        builtin: true,
        downloads: 0,
        rating: 4.9,
        createdAt: '2026-01-01T00:00:00Z',
      },
      {
        id: 'memory-system',
        name: 'Memory System',
        description: 'Persistent memory with vector search',
        version: '1.0.0',
        author: 'NovaRoute',
        category: PluginCategory.MEMORY,
        tags: ['memory', 'vector', 'search'],
        hooks: ['session:start', 'session:end'],
        builtin: true,
        downloads: 0,
        rating: 4.6,
        createdAt: '2026-01-01T00:00:00Z',
      },
      {
        id: 'whatsapp-channel',
        name: 'WhatsApp Channel',
        description: 'WhatsApp messaging integration',
        version: '1.0.0',
        author: 'NovaRoute',
        category: PluginCategory.CHANNEL,
        tags: ['whatsapp', 'messaging'],
        hooks: ['message:receive', 'message:send'],
        builtin: true,
        downloads: 0,
        rating: 4.3,
        createdAt: '2026-01-01T00:00:00Z',
      },
      {
        id: 'telegram-channel',
        name: 'Telegram Channel',
        description: 'Telegram bot integration',
        version: '1.0.0',
        author: 'NovaRoute',
        category: PluginCategory.CHANNEL,
        tags: ['telegram', 'bot', 'messaging'],
        hooks: ['message:receive', 'message:send'],
        builtin: true,
        downloads: 0,
        rating: 4.4,
        createdAt: '2026-01-01T00:00:00Z',
      },
      {
        id: 'slack-channel',
        name: 'Slack Channel',
        description: 'Slack workspace integration',
        version: '1.0.0',
        author: 'NovaRoute',
        category: PluginCategory.CHANNEL,
        tags: ['slack', 'workspace', 'messaging'],
        hooks: ['message:receive', 'message:send'],
        builtin: true,
        downloads: 0,
        rating: 4.2,
        createdAt: '2026-01-01T00:00:00Z',
      },
      {
        id: 'discord-channel',
        name: 'Discord Channel',
        description: 'Discord server integration',
        version: '1.0.0',
        author: 'NovaRoute',
        category: PluginCategory.CHANNEL,
        tags: ['discord', 'server', 'messaging'],
        hooks: ['message:receive', 'message:send'],
        builtin: true,
        downloads: 0,
        rating: 4.1,
        createdAt: '2026-01-01T00:00:00Z',
      },
      {
        id: 'voice-system',
        name: 'Voice System',
        description: 'TTS, STT, and WebRTC voice calls',
        version: '1.0.0',
        author: 'NovaRoute',
        category: PluginCategory.VOICE,
        tags: ['voice', 'tts', 'stt', 'webrtc'],
        hooks: ['voice:call'],
        builtin: true,
        downloads: 0,
        rating: 4.0,
        createdAt: '2026-01-01T00:00:00Z',
      },
      {
        id: 'a2a-protocol',
        name: 'A2A Protocol',
        description: 'Agent-to-agent communication',
        version: '1.0.0',
        author: 'NovaRoute',
        category: PluginCategory.TOOL,
        tags: ['a2a', 'agent', 'protocol'],
        hooks: ['a2a:message'],
        builtin: true,
        downloads: 0,
        rating: 4.5,
        createdAt: '2026-01-01T00:00:00Z',
      },
      {
        id: 'chaos-engineering',
        name: 'Chaos Engineering',
        description: 'Resilience testing & failure injection',
        version: '1.0.0',
        author: 'NovaRoute',
        category: PluginCategory.SECURITY,
        tags: ['chaos', 'testing', 'resilience'],
        hooks: ['request:intercept'],
        builtin: true,
        downloads: 0,
        rating: 4.3,
        createdAt: '2026-01-01T00:00:00Z',
      },
      {
        id: 'conductor',
        name: 'Conductor',
        description: 'Fleet orchestration & multi-agent management',
        version: '1.0.0',
        author: 'NovaRoute',
        category: PluginCategory.OTHER,
        tags: ['conductor', 'fleet', 'orchestration'],
        hooks: ['agent:register', 'task:dispatch'],
        builtin: true,
        downloads: 0,
        rating: 4.4,
        createdAt: '2026-01-01T00:00:00Z',
      },
    ];

    for (const plugin of builtins) {
      this.plugins.set(plugin.id, plugin);
      this.installed.set(plugin.id, {
        ...plugin,
        installedAt: '2026-01-01T00:00:00Z',
        enabled: true,
        config: {},
      });
    }
  }

  /**
   * Register a new plugin
   */
  register(manifest) {
    const plugin = {
      id: manifest.id || crypto.randomUUID(),
      name: manifest.name,
      description: manifest.description || '',
      version: manifest.version || '1.0.0',
      author: manifest.author || 'Unknown',
      category: manifest.category || PluginCategory.OTHER,
      tags: manifest.tags || [],
      hooks: manifest.hooks || [],
      builtin: false,
      downloads: 0,
      rating: 0,
      createdAt: new Date().toISOString(),
      homepage: manifest.homepage,
      repository: manifest.repository,
    };

    this.plugins.set(plugin.id, plugin);
    this.emit('plugin:registered', plugin);
    return plugin;
  }

  /**
   * Install a plugin
   */
  install(pluginId, config = {}) {
    const manifest = this.plugins.get(pluginId);
    if (!manifest) throw new Error(`Plugin not found: ${pluginId}`);
    if (this.installed.has(pluginId)) throw new Error(`Plugin already installed: ${pluginId}`);

    const installed = {
      ...manifest,
      installedAt: new Date().toISOString(),
      enabled: true,
      config,
    };

    this.installed.set(pluginId, installed);
    manifest.downloads += 1;
    this.emit('plugin:installed', installed);
    return installed;
  }

  /**
   * Uninstall a plugin
   */
  uninstall(pluginId) {
    const installed = this.installed.get(pluginId);
    if (!installed) throw new Error(`Plugin not installed: ${pluginId}`);
    if (installed.builtin) throw new Error(`Cannot uninstall builtin plugin: ${pluginId}`);

    this.installed.delete(pluginId);
    this.emit('plugin:uninstalled', { pluginId });
    return true;
  }

  /**
   * Enable/disable a plugin
   */
  toggle(pluginId, enabled) {
    const installed = this.installed.get(pluginId);
    if (!installed) throw new Error(`Plugin not installed: ${pluginId}`);
    installed.enabled = enabled;
    this.emit('plugin:toggled', { pluginId, enabled });
    return installed;
  }

  /**
   * Search plugins
   */
  search(query, options = {}) {
    const { category, tags, sort = 'downloads' } = options;
    let results = [...this.plugins.values()];

    if (query) {
      const q = query.toLowerCase();
      results = results.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.tags.some(t => t.includes(q))
      );
    }

    if (category) results = results.filter(p => p.category === category);
    if (tags) results = results.filter(p => tags.some(t => p.tags.includes(t)));

    // Sort
    if (sort === 'downloads') results.sort((a, b) => b.downloads - a.downloads);
    if (sort === 'rating') results.sort((a, b) => b.rating - a.rating);
    if (sort === 'newest') results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    if (sort === 'name') results.sort((a, b) => a.name.localeCompare(b.name));

    return results;
  }

  /**
   * Get plugin details
   */
  get(pluginId) {
    return this.plugins.get(pluginId);
  }

  /**
   * Get installed plugins
   */
  getInstalled() {
    return [...this.installed.values()];
  }

  /**
   * Get marketplace stats
   */
  stats() {
    const plugins = [...this.plugins.values()];
    return {
      total: plugins.length,
      installed: this.installed.size,
      byCategory: Object.values(PluginCategory).reduce((acc, cat) => {
        acc[cat] = plugins.filter(p => p.category === cat).length;
        return acc;
      }, {}),
      totalDownloads: plugins.reduce((s, p) => s + p.downloads, 0),
    };
  }
}

// Singleton
let _instance = null;

function getPluginRegistry() {
  if (!_instance) _instance = new PluginRegistry();
  return _instance;
}

module.exports = {
  PluginCategory,
  PluginRegistry,
  getPluginRegistry,
};
