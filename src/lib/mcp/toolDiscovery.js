/**
 * Tool Discovery System for MCP Servers
 * 
 * Discovers and catalogs tools from installed MCP servers.
 * Provides unified tool listing and filtering capabilities.
 */

const { getMcpServerManager } = require("./mcpServerManager");

/**
 * Tool Discovery Manager
 * Handles discovery, caching, and filtering of tools from MCP servers
 */
class ToolDiscovery {
  constructor(options = {}) {
    this.manager = options.manager || getMcpServerManager();
    this.toolCache = new Map();
    this.discoveryInterval = options.discoveryInterval || 300000; // 5 minutes
    this.lastDiscovery = null;
  }

  /**
   * Discover all tools from all installed servers
   */
  async discoverAll() {
    const allTools = [];
    const installedServers = this.manager.listInstalledServers();
    
    for (const server of installedServers) {
      try {
        const tools = await this.discoverForServer(server.id);
        allTools.push(...tools);
      } catch (error) {
        console.error(`[ToolDiscovery] Failed for ${server.id}:`, error.message);
      }
    }
    
    this.lastDiscovery = Date.now();
    return allTools;
  }

  /**
   * Discover tools for a specific server
   */
  async discoverForServer(pluginId) {
    const tools = await this.manager.discoverTools(pluginId);
    
    // Cache tools
    this.toolCache.set(pluginId, {
      tools,
      discoveredAt: Date.now(),
    });
    
    return tools;
  }

  /**
   * Get all cached tools
   */
  getAllTools() {
    const allTools = [];
    
    for (const [pluginId, cache] of this.toolCache) {
      allTools.push(...cache.tools);
    }
    
    return allTools;
  }

  /**
   * Get tools for a specific server
   */
  getToolsForServer(pluginId) {
    const cache = this.toolCache.get(pluginId);
    return cache?.tools || [];
  }

  /**
   * Search tools by name or description
   */
  searchTools(query) {
    const allTools = this.getAllTools();
    const lowerQuery = query.toLowerCase();
    
    return allTools.filter(tool => 
      tool.name.toLowerCase().includes(lowerQuery) ||
      tool.description.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Filter tools by category
   */
  filterByCategory(category) {
    const allTools = this.getAllTools();
    const installedServers = this.manager.listInstalledServers();
    
    // Create a map of pluginId to category
    const categoryMap = new Map();
    for (const server of installedServers) {
      const plugin = this.manager.getPlugin(server.pluginId);
      if (plugin) {
        categoryMap.set(server.pluginId, plugin.category);
      }
    }
    
    return allTools.filter(tool => 
      categoryMap.get(tool.pluginId) === category
    );
  }

  /**
   * Filter tools by plugin
   */
  filterByPlugin(pluginId) {
    return this.getToolsForServer(pluginId);
  }

  /**
   * Get tool by name
   */
  getToolByName(name) {
    const allTools = this.getAllTools();
    return allTools.find(tool => tool.name === name) || null;
  }

  /**
   * Get tool by full name (pluginId-toolName)
   */
  getToolByFullName(fullName) {
    const allTools = this.getAllTools();
    return allTools.find(tool => 
      `${tool.pluginId}-${tool.name}` === fullName ||
      tool.name === fullName
    ) || null;
  }

  /**
   * Check if a tool is available
   */
  isToolAvailable(name) {
    const tool = this.getToolByName(name);
    return tool !== null;
  }

  /**
   * Get tool definitions for LLM consumption
   * Converts internal tool format to OpenAI-compatible format
   */
  getToolDefinitionsForLLM() {
    const allTools = this.getAllTools();
    
    return allTools.map(tool => ({
      type: "function",
      function: {
        name: `${tool.pluginId}_${tool.name}`,
        description: tool.description,
        parameters: tool.inputSchema || {
          type: "object",
          properties: {},
        },
      },
    }));
  }

  /**
   * Get tool definitions for Claude
   * Converts internal tool format to Claude-compatible format
   */
  getToolDefinitionsForClaude() {
    const allTools = this.getAllTools();
    
    return allTools.map(tool => ({
      name: `${tool.pluginId}_${tool.name}`,
      description: tool.description,
      input_schema: tool.inputSchema || {
        type: "object",
        properties: {},
      },
    }));
  }

  /**
   * Refresh tool cache
   */
  async refresh() {
    this.toolCache.clear();
    return await this.discoverAll();
  }

  /**
   * Get discovery statistics
   */
  getStats() {
    const allTools = this.getAllTools();
    const installedServers = this.manager.listInstalledServers();
    
    const toolsByPlugin = {};
    for (const tool of allTools) {
      toolsByPlugin[tool.pluginId] = (toolsByPlugin[tool.pluginId] || 0) + 1;
    }
    
    return {
      totalTools: allTools.length,
      totalServers: installedServers.length,
      toolsByPlugin,
      lastDiscovery: this.lastDiscovery,
    };
  }
}

// Singleton instance
let discoveryInstance = null;

/**
 * Get or create Tool Discovery instance
 */
function getToolDiscovery(options = {}) {
  if (!discoveryInstance) {
    discoveryInstance = new ToolDiscovery(options);
  }
  return discoveryInstance;
}

module.exports = {
  ToolDiscovery,
  getToolDiscovery,
};
