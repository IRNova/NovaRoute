/**
 * MCP Server Manager - Dynamic MCP server management for NovaRoute
 * 
 * Inspired by Grok Bot's SandMcpManager, adapted for NovaRoute's architecture.
 * Manages installation, configuration, lifecycle, and tool discovery for MCP servers.
 */

const crypto = require("crypto");
const { EventEmitter } = require("events");

// Default plugin catalog (extendable)
const DEFAULT_CATALOG = [
  {
    id: "exa",
    name: "Exa",
    displayName: "Exa Search",
    description: "Real-time web search and code documentation",
    category: "search",
    url: "https://mcp.exa.ai/mcp",
    transport: "http",
    oauth: false,
    toolNames: ["web_search_exa", "web_fetch_exa"],
    skills: [
      { name: "Web Search", description: "Search the web for real-time information" },
      { name: "Code Docs", description: "Fetch documentation for code libraries" },
    ],
  },
  {
    id: "tavily",
    name: "Tavily",
    displayName: "Tavily Search",
    description: "Real-time web search optimized for LLM agents",
    category: "search",
    url: "https://mcp.tavily.com/mcp",
    transport: "http",
    oauth: true,
    toolNames: ["tavily_search", "tavily_extract", "tavily_crawl", "tavily_map"],
    skills: [
      { name: "Search", description: "AI-optimized web search" },
      { name: "Extract", description: "Extract content from URLs" },
      { name: "Crawl", description: "Crawl website content" },
    ],
  },
  {
    id: "browsermcp",
    name: "Browser MCP",
    displayName: "Browser Control",
    description: "Control your running Chrome (requires Chrome extension)",
    category: "browser",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@browsermcp/mcp@latest"],
    toolNames: [
      "browser_navigate", "browser_snapshot", "browser_click",
      "browser_type", "browser_screenshot", "browser_get_console_logs",
      "browser_wait", "browser_press_key", "browser_go_back", "browser_go_forward"
    ],
    skills: [
      { name: "Navigate", description: "Navigate to URLs" },
      { name: "Click", description: "Click on elements" },
      { name: "Type", description: "Type text into inputs" },
      { name: "Screenshot", description: "Take screenshots" },
    ],
  },
  {
    id: "filesystem",
    name: "Filesystem",
    displayName: "File System Access",
    description: "Read and write files on the local filesystem",
    category: "utility",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"],
    toolNames: ["read_file", "write_file", "list_directory", "search_files"],
    skills: [
      { name: "Read File", description: "Read file contents" },
      { name: "Write File", description: "Write file contents" },
      { name: "List Directory", description: "List directory contents" },
    ],
  },
];

/**
 * MCP Server Manager
 * Manages MCP server lifecycle, tool discovery, and execution
 */
class McpServerManager extends EventEmitter {
  constructor(options = {}) {
    super();
    this.dataDir = options.dataDir || process.env.DATA_DIR || "~/.novaroute";
    this.catalog = [...DEFAULT_CATALOG, ...(options.extraCatalog || [])];
    this.installedServers = new Map();
    this.toolCache = new Map();
    this.serverStates = new Map();
    
    // Load persisted state
    this._loadState();
  }

  /**
   * Get the full plugin catalog
   */
  getCatalog() {
    return this.catalog.map(plugin => ({
      ...plugin,
      isInstalled: this.installedServers.has(plugin.id),
      status: this.serverStates.get(plugin.id)?.status || "not-installed",
      toolCount: this.toolCache.get(plugin.id)?.length || 0,
    }));
  }

  /**
   * Get a specific plugin from catalog
   */
  getPlugin(pluginId) {
    return this.catalog.find(p => p.id === pluginId) || null;
  }

  /**
   * Install an MCP server
   */
  async installServer(pluginId, options = {}) {
    const plugin = this.getPlugin(pluginId);
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }

    if (this.installedServers.has(pluginId)) {
      throw new Error(`Plugin already installed: ${pluginId}`);
    }

    // Create server entry
    const serverEntry = {
      id: pluginId,
      pluginId,
      name: plugin.name,
      displayName: plugin.displayName,
      description: plugin.description,
      transport: plugin.transport,
      url: plugin.url,
      command: plugin.command,
      args: plugin.args,
      oauth: plugin.oauth || false,
      customInstructions: options.customInstructions || "",
      accountKey: options.accountKey || "default",
      toolPolicy: plugin.toolNames?.reduce((acc, name) => {
        acc[name] = "allow";
        return acc;
      }, {}) || {},
      installedAt: new Date().toISOString(),
      status: "installed",
    };

    // Persist installation
    this.installedServers.set(pluginId, serverEntry);
    this.serverStates.set(pluginId, { status: "installed", toolCount: 0 });
    
    // Save state
    await this._saveState();
    
    // Emit event
    this.emit("server:installed", serverEntry);
    
    return serverEntry;
  }

  /**
   * Uninstall an MCP server
   */
  async uninstallServer(pluginId) {
    if (!this.installedServers.has(pluginId)) {
      throw new Error(`Plugin not installed: ${pluginId}`);
    }

    const server = this.installedServers.get(pluginId);
    
    // Remove from installed
    this.installedServers.delete(pluginId);
    this.toolCache.delete(pluginId);
    this.serverStates.delete(pluginId);
    
    // Save state
    await this._saveState();
    
    // Emit event
    this.emit("server:uninstalled", server);
    
    return { removed: true, pluginId };
  }

  /**
   * List all installed servers
   */
  listInstalledServers() {
    return Array.from(this.installedServers.values());
  }

  /**
   * Get server status
   */
  getServerStatus(pluginId) {
    const state = this.serverStates.get(pluginId);
    return {
      pluginId,
      status: state?.status || "not-installed",
      toolCount: state?.toolCount || 0,
      lastError: state?.lastError || null,
    };
  }

  /**
   * Discover tools for a server
   */
  async discoverTools(pluginId) {
    const server = this.installedServers.get(pluginId);
    if (!server) {
      throw new Error(`Server not installed: ${pluginId}`);
    }

    // For now, use catalog tool names
    // In production, this would connect to the MCP server and list tools
    const plugin = this.getPlugin(pluginId);
    const tools = (plugin?.toolNames || []).map(name => ({
      name,
      pluginId,
      description: `${name} from ${plugin?.displayName || pluginId}`,
      inputSchema: {}, // Would be fetched from server
      source: {
        providerIdentifier: pluginId,
        toolName: name,
      },
    }));

    // Cache tools
    this.toolCache.set(pluginId, tools);
    
    // Update state
    this.serverStates.set(pluginId, {
      ...this.serverStates.get(pluginId),
      toolCount: tools.length,
      status: "connected",
    });

    return tools;
  }

  /**
   * Get all tools from all installed servers
   */
  async getAllTools() {
    const allTools = [];
    
    for (const [pluginId] of this.installedServers) {
      try {
        const tools = await this.discoverTools(pluginId);
        allTools.push(...tools);
      } catch (error) {
        console.error(`[MCP] Failed to discover tools for ${pluginId}:`, error.message);
      }
    }
    
    return allTools;
  }

  /**
   * Execute a tool call
   */
  async executeTool(toolDefinition, args, options = {}) {
    const { pluginId, toolName } = toolDefinition.source || {};
    
    if (!pluginId || !toolName) {
      throw new Error("Invalid tool definition: missing pluginId or toolName");
    }

    const server = this.installedServers.get(pluginId);
    if (!server) {
      throw new Error(`Server not installed: ${pluginId}`);
    }

    // Check tool policy
    if (server.toolPolicy[toolName] === "deny") {
      throw new Error(`Tool denied by policy: ${toolName}`);
    }

    // Execute via appropriate transport
    if (server.transport === "stdio") {
      return await this._executeViaStdio(server, toolName, args, options);
    } else {
      return await this._executeViaHttp(server, toolName, args, options);
    }
  }

  /**
   * Execute tool via stdio bridge
   */
  async _executeViaStdio(server, toolName, args, options) {
    // This would use the existing stdioSseBridge
    const { sendToChild, isRunning } = require("./stdioSseBridge");
    
    if (!isRunning(server.id)) {
      throw new Error(`stdio bridge not running for ${server.id}`);
    }

    const request = {
      jsonrpc: "2.0",
      id: crypto.randomUUID(),
      method: "tools/call",
      params: {
        name: toolName,
        arguments: args,
      },
    };

    // Send request and wait for response
    // In production, this would handle streaming responses
    sendToChild(server.id, request);
    
    return {
      content: [{ type: "text", text: `Tool ${toolName} executed via stdio` }],
    };
  }

  /**
   * Execute tool via HTTP
   */
  async _executeViaHttp(server, toolName, args, options) {
    const fetch = globalThis.fetch || (await import("undici")).fetch;
    
    const request = {
      jsonrpc: "2.0",
      id: crypto.randomUUID(),
      method: "tools/call",
      params: {
        name: toolName,
        arguments: args,
      },
    };

    const response = await fetch(server.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Set custom instructions for a server
   */
  async setCustomInstructions(pluginId, instructions) {
    const server = this.installedServers.get(pluginId);
    if (!server) {
      throw new Error(`Server not installed: ${pluginId}`);
    }

    server.customInstructions = instructions;
    await this._saveState();
    
    this.emit("server:instructions-updated", { pluginId, instructions });
    
    return server;
  }

  /**
   * Update tool policy for a server
   */
  async updateToolPolicy(pluginId, toolName, action) {
    const server = this.installedServers.get(pluginId);
    if (!server) {
      throw new Error(`Server not installed: ${pluginId}`);
    }

    server.toolPolicy[toolName] = action; // "allow" or "deny"
    await this._saveState();
    
    this.emit("server:policy-updated", { pluginId, toolName, action });
    
    return server;
  }

  /**
   * Restart a server
   */
  async restartServer(pluginId) {
    const server = this.installedServers.get(pluginId);
    if (!server) {
      throw new Error(`Server not installed: ${pluginId}`);
    }

    // Update state
    this.serverStates.set(pluginId, { status: "restarting" });
    this.emit("server:restarting", { pluginId });

    // In production, this would restart the actual server process
    // For now, just update status
    this.serverStates.set(pluginId, { status: "connected", toolCount: 0 });
    this.emit("server:restarted", { pluginId });

    return { pluginId, status: "restarted" };
  }

  /**
   * Get plugin skills (for integration with NovaRoute's skill system)
   */
  getPluginSkills(pluginId) {
    const plugin = this.getPlugin(pluginId);
    if (!plugin) return [];
    
    return plugin.skills || [];
  }

  /**
   * Get all available skills from all installed servers
   */
  getAllSkills() {
    const skills = [];
    
    for (const [pluginId] of this.installedServers) {
      const pluginSkills = this.getPluginSkills(pluginId);
      skills.push(...pluginSkills.map(skill => ({
        ...skill,
        pluginId,
      })));
    }
    
    return skills;
  }

  /**
   * Load state from disk
   */
  _loadState() {
    try {
      const fs = require("fs");
      const path = require("path");
      const statePath = path.join(this.dataDir, "mcp-servers.json");
      
      if (fs.existsSync(statePath)) {
        const data = JSON.parse(fs.readFileSync(statePath, "utf8"));
        
        if (data.installedServers) {
          for (const [id, server] of Object.entries(data.installedServers)) {
            this.installedServers.set(id, server);
          }
        }
        
        if (data.serverStates) {
          for (const [id, state] of Object.entries(data.serverStates)) {
            this.serverStates.set(id, state);
          }
        }
      }
    } catch (error) {
      console.error("[MCP] Failed to load state:", error.message);
    }
  }

  /**
   * Save state to disk
   */
  async _saveState() {
    try {
      const fs = require("fs");
      const path = require("path");
      
      const stateDir = path.dirname(path.join(this.dataDir, "mcp-servers.json"));
      if (!fs.existsSync(stateDir)) {
        fs.mkdirSync(stateDir, { recursive: true });
      }
      
      const statePath = path.join(this.dataDir, "mcp-servers.json");
      const data = {
        installedServers: Object.fromEntries(this.installedServers),
        serverStates: Object.fromEntries(this.serverStates),
        updatedAt: new Date().toISOString(),
      };
      
      fs.writeFileSync(statePath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error("[MCP] Failed to save state:", error.message);
    }
  }
}

// Singleton instance
let managerInstance = null;

/**
 * Get or create MCP Server Manager instance
 */
function getMcpServerManager(options = {}) {
  if (!managerInstance) {
    managerInstance = new McpServerManager(options);
  }
  return managerInstance;
}

module.exports = {
  McpServerManager,
  getMcpServerManager,
  DEFAULT_CATALOG,
};
