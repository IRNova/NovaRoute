/**
 * Discovery System — automatic provider and capability discovery
 * Probes endpoints to discover available models and features
 */

export class DiscoverySystem {
  constructor(options = {}) {
    this.providers = new Map();
    this.discoveryQueue = [];
    this.isRunning = false;
    this.probeTimeout = options.probeTimeoutMs ?? 5000;
    this.cacheExpiry = options.cacheExpiryMs ?? 300_000; // 5 min
  }

  /**
   * Register a provider for discovery
   */
  registerProvider(id, config) {
    this.providers.set(id, {
      id,
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      apiType: config.apiType ?? 'openai',
      capabilities: [],
      models: [],
      lastDiscovered: null,
      status: 'pending',
    });
    return this;
  }

  /**
   * Discover capabilities of a provider
   */
  async discover(providerId) {
    const provider = this.providers.get(providerId);
    if (!provider) throw new Error(`Provider '${providerId}' not found`);

    const result = {
      providerId,
      discoveredAt: new Date().toISOString(),
      models: [],
      capabilities: [],
      endpoints: [],
      latency: 0,
      status: 'success',
    };

    const start = Date.now();

    try {
      // Probe /v1/models
      const modelsResult = await this._probeModels(provider);
      result.models = modelsResult.models;
      result.endpoints.push({ path: '/v1/models', status: modelsResult.status });

      // Probe capabilities based on models
      result.capabilities = this._inferCapabilities(result.models);

      // Probe specific endpoints
      const endpoints = ['/v1/chat/completions', '/v1/embeddings', '/v1/images/generations', '/v1/audio/speech'];
      for (const endpoint of endpoints) {
        const status = await this._probeEndpoint(provider, endpoint);
        result.endpoints.push({ path: endpoint, status });
      }

      provider.models = result.models;
      provider.capabilities = result.capabilities;
      provider.lastDiscovered = result.discoveredAt;
      provider.status = 'discovered';
    } catch (error) {
      result.status = 'error';
      result.error = error.message;
      provider.status = 'error';
    }

    result.latency = Date.now() - start;
    return result;
  }

  /**
   * Discover all registered providers
   */
  async discoverAll() {
    const results = [];
    for (const [id] of this.providers) {
      const result = await this.discover(id);
      results.push(result);
    }
    return results;
  }

  /**
   * Get provider discovery status
   */
  getStatus(providerId) {
    const provider = this.providers.get(providerId);
    if (!provider) return null;
    return {
      id: provider.id,
      status: provider.status,
      modelCount: provider.models.length,
      capabilities: provider.capabilities,
      lastDiscovered: provider.lastDiscovered,
    };
  }

  /**
   * Get all discovered providers
   */
  getAll() {
    return [...this.providers.values()].map(p => ({
      id: p.id,
      status: p.status,
      modelCount: p.models.length,
      capabilities: p.capabilities,
      lastDiscovered: p.lastDiscovered,
    }));
  }

  /**
   * Get cached models for a provider
   */
  getCachedModels(providerId) {
    const provider = this.providers.get(providerId);
    if (!provider) return [];

    // Check cache expiry
    if (provider.lastDiscovered) {
      const elapsed = Date.now() - new Date(provider.lastDiscovered).getTime();
      if (elapsed > this.cacheExpiry) return []; // expired
    }

    return provider.models;
  }

  async _probeModels(provider) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.probeTimeout);

      const headers = {};
      if (provider.apiKey) {
        headers['Authorization'] = `Bearer ${provider.apiKey}`;
      }

      const response = await fetch(`${provider.baseUrl}/v1/models`, {
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        return { models: [], status: response.status };
      }

      const data = await response.json();
      const models = (data.data ?? []).map(m => ({
        id: m.id,
        name: m.id,
        owned_by: m.owned_by,
      }));

      return { models, status: 200 };
    } catch (error) {
      return { models: [], status: 'error', error: error.message };
    }
  }

  async _probeEndpoint(provider, path) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.probeTimeout);

      const headers = {};
      if (provider.apiKey) {
        headers['Authorization'] = `Bearer ${provider.apiKey}`;
      }

      // Just check if endpoint exists (OPTIONS or HEAD)
      const response = await fetch(`${provider.baseUrl}${path}`, {
        method: 'HEAD',
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeout);
      return response.status;
    } catch {
      return 'unreachable';
    }
  }

  _inferCapabilities(models) {
    const caps = new Set();

    for (const model of models) {
      const id = model.id.toLowerCase();

      if (id.includes('embed')) caps.add('embeddings');
      if (id.includes('image') || id.includes('dall') || id.includes('flux')) caps.add('images');
      if (id.includes('tts') || id.includes('speech') || id.includes('audio')) caps.add('tts');
      if (id.includes('whisper') || id.includes('transcri')) caps.add('stt');
      if (id.includes('video') || id.includes('sora') || id.includes('runway')) caps.add('video');
      if (id.includes('search') || id.includes('perplexity')) caps.add('webSearch');
      if (id.includes('code') || id.includes('coder') || id.includes('codex')) caps.add('code');
      if (id.includes('vision') || id.includes('gpt-4') || id.includes('claude')) caps.add('vision');
    }

    if (models.length > 0) caps.add('chat');
    return [...caps];
  }
}
