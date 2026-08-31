/**
 * Plugin SDK for NovaRoute
 * 
 * Provides framework for building and managing plugins.
 * Inspired by OpenClaw's plugin system.
 */

const { EventEmitter } = require("events");
const crypto = require("crypto");

/**
 * Plugin Status
 */
const PluginStatus = {
  DISABLED: "disabled",
  ENABLING: "enabling",
  ENABLED: "enabled",
  DISABLING: "disabling",
  ERROR: "error",
};

/**
 * Plugin Types
 */
const PluginTypes = {
  CHANNEL: "channel",
  PROVIDER: "provider",
  TOOL: "tool",
  SKILL: "skill",
  EXTENSION: "extension",
};

/**
 * Plugin Base Class
 */
class Plugin extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.id = options.id || crypto.randomUUID();
    this.name = options.name || "unknown";
    this.version = options.version || "1.0.0";
    this.description = options.description || "";
    this.author = options.author || "";
    this.type = options.type || PluginTypes.EXTENSION;
    this.status = PluginStatus.DISABLED;
    
    this.config = options.config || {};
    this.permissions = options.permissions || [];
    this.dependencies = options.dependencies || [];
    
    this.manifest = {
      id: this.id,
      name: this.name,
      version: this.version,
      description: this.description,
      author: this.author,
      type: this.type,
      permissions: this.permissions,
      dependencies: this.dependencies,
    };
  }

  /**
   * Initialize plugin
   */
  async init(context) {
    throw new Error("init() must be implemented by plugin");
  }

  /**
   * Start plugin
   */
  async start() {
    throw new Error("start() must be implemented by plugin");
  }

  /**
   * Stop plugin
   */
  async stop() {
    throw new Error("stop() must be implemented by plugin");
  }

  /**
   * Get plugin info
   */
  getInfo() {
    return {
      ...this.manifest,
      status: this.status,
      config: this.config,
    };
  }

  /**
   * Update config
   */
  updateConfig(config) {
    this.config = { ...this.config, ...config };
    this.emit("config_updated", this.config);
  }
}

/**
 * Plugin Manager
 */
class PluginManager extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.plugins = new Map();
    this.pluginPaths = options.pluginPaths || [];
    this.context = options.context || {};
    
    this.registry = new Map();
    this.hooks = new Map();
  }

  /**
   * Register a plugin
   */
  register(plugin) {
    if (this.plugins.has(plugin.id)) {
      throw new Error(`Plugin already registered: ${plugin.id}`);
    }
    
    this.plugins.set(plugin.id, plugin);
    this.emit("plugin_registered", plugin.getInfo());
    
    return plugin.id;
  }

  /**
   * Unregister a plugin
   */
  unregister(pluginId) {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }
    
    this.plugins.delete(pluginId);
    this.emit("plugin_unregistered", pluginId);
    
    return true;
  }

  /**
   * Enable a plugin
   */
  async enable(pluginId) {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }
    
    if (plugin.status === PluginStatus.ENABLED) {
      return true;
    }
    
    plugin.status = PluginStatus.ENABLING;
    this.emit("plugin_enabling", pluginId);
    
    try {
      await plugin.init(this.context);
      await plugin.start();
      
      plugin.status = PluginStatus.ENABLED;
      this.emit("plugin_enabled", pluginId);
      
      return true;
    } catch (error) {
      plugin.status = PluginStatus.ERROR;
      this.emit("plugin_error", { pluginId, error: error.message });
      
      throw error;
    }
  }

  /**
   * Disable a plugin
   */
  async disable(pluginId) {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }
    
    if (plugin.status === PluginStatus.DISABLED) {
      return true;
    }
    
    plugin.status = PluginStatus.DISABLING;
    this.emit("plugin_disabling", pluginId);
    
    try {
      await plugin.stop();
      
      plugin.status = PluginStatus.DISABLED;
      this.emit("plugin_disabled", pluginId);
      
      return true;
    } catch (error) {
      plugin.status = PluginStatus.ERROR;
      this.emit("plugin_error", { pluginId, error: error.message });
      
      throw error;
    }
  }

  /**
   * Get a plugin
   */
  getPlugin(pluginId) {
    return this.plugins.get(pluginId);
  }

  /**
   * List all plugins
   */
  listPlugins() {
    const plugins = [];
    
    for (const [pluginId, plugin] of this.plugins) {
      plugins.push(plugin.getInfo());
    }
    
    return plugins;
  }

  /**
   * List enabled plugins
   */
  listEnabledPlugins() {
    const plugins = [];
    
    for (const [pluginId, plugin] of this.plugins) {
      if (plugin.status === PluginStatus.ENABLED) {
        plugins.push(plugin.getInfo());
      }
    }
    
    return plugins;
  }

  /**
   * Register a hook
   */
  registerHook(hookName, handler) {
    if (!this.hooks.has(hookName)) {
      this.hooks.set(hookName, []);
    }
    
    this.hooks.get(hookName).push(handler);
  }

  /**
   * Execute a hook
   */
  async executeHook(hookName, data) {
    const handlers = this.hooks.get(hookName) || [];
    let result = data;
    
    for (const handler of handlers) {
      try {
        result = await handler(result);
      } catch (error) {
        console.error(`[PluginSDK] Hook ${hookName} error:`, error);
      }
    }
    
    return result;
  }

  /**
   * Get health status
   */
  async healthCheck() {
    const status = {
      totalPlugins: this.plugins.size,
      enabledPlugins: this.listEnabledPlugins().length,
      plugins: {},
    };
    
    for (const [pluginId, plugin] of this.plugins) {
      status.plugins[pluginId] = {
        name: plugin.name,
        status: plugin.status,
        version: plugin.version,
      };
    }
    
    return status;
  }
}

// Singleton instance
let sdkInstance = null;

/**
 * Get or create Plugin SDK instance
 */
function getPluginSDK(options = {}) {
  if (!sdkInstance) {
    sdkInstance = new PluginManager(options);
  }
  return sdkInstance;
}

module.exports = {
  Plugin,
  PluginManager,
  PluginStatus,
  PluginTypes,
  getPluginSDK,
};
