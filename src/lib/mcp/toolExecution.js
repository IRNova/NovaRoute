/**
 * Tool Execution Bridge for MCP Servers
 * 
 * Handles execution of tools across different MCP server transports.
 * Provides unified execution interface with error handling and retry logic.
 */

const crypto = require("crypto");
const { getMcpServerManager } = require("./mcpServerManager");
const { getToolDiscovery } = require("./toolDiscovery");

/**
 * Tool Executor
 * Executes tools from MCP servers with retry logic and error handling
 */
class ToolExecutor {
  constructor(options = {}) {
    this.manager = options.manager || getMcpServerManager();
    this.discovery = options.discovery || getToolDiscovery();
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 1000;
    this.executionLog = [];
  }

  /**
   * Execute a tool by name
   */
  async execute(toolName, args, options = {}) {
    const startTime = Date.now();
    const executionId = crypto.randomUUID();
    
    // Find the tool
    const tool = this.discovery.getToolByName(toolName);
    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`);
    }
    
    // Check tool policy
    const server = this.manager.installedServers.get(tool.pluginId);
    if (!server) {
      throw new Error(`Server not installed: ${tool.pluginId}`);
    }
    
    if (server.toolPolicy[toolName] === "deny") {
      throw new Error(`Tool denied by policy: ${toolName}`);
    }
    
    // Execute with retry logic
    let lastError;
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const result = await this._executeWithTimeout(
          tool,
          args,
          options.timeout || 30000
        );
        
        const executionTime = Date.now() - startTime;
        
        // Log execution
        this._logExecution({
          id: executionId,
          toolName,
          pluginId: tool.pluginId,
          args,
          result,
          attempt,
          executionTime,
          success: true,
        });
        
        return {
          id: executionId,
          toolName,
          pluginId: tool.pluginId,
          content: result.content || [{ type: "text", text: JSON.stringify(result) }],
          executionTime,
          attempt,
        };
      } catch (error) {
        lastError = error;
        
        if (attempt < this.maxRetries) {
          console.warn(
            `[ToolExecutor] Attempt ${attempt} failed for ${toolName}:`,
            error.message
          );
          await this._delay(this.retryDelay * attempt);
        }
      }
    }
    
    // All retries failed
    const executionTime = Date.now() - startTime;
    
    this._logExecution({
      id: executionId,
      toolName,
      pluginId: tool.pluginId,
      args,
      error: lastError.message,
      attempt: this.maxRetries,
      executionTime,
      success: false,
    });
    
    throw new Error(
      `Tool execution failed after ${this.maxRetries} attempts: ${lastError.message}`
    );
  }

  /**
   * Execute tool with timeout
   */
  async _executeWithTimeout(tool, args, timeout) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Tool execution timed out after ${timeout}ms`));
      }, timeout);
      
      this.manager
        .executeTool(tool, args)
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * Execute multiple tools in parallel
   */
  async executeParallel(toolCalls) {
    const promises = toolCalls.map(call =>
      this.execute(call.toolName, call.args, call.options)
        .then(result => ({ ...call, result, success: true }))
        .catch(error => ({ ...call, error: error.message, success: false }))
    );
    
    return Promise.all(promises);
  }

  /**
   * Execute tool chain (sequential execution)
   */
  async executeChain(toolCalls) {
    const results = [];
    
    for (const call of toolCalls) {
      try {
        const result = await this.execute(call.toolName, call.args, call.options);
        results.push({ ...call, result, success: true });
      } catch (error) {
        results.push({ ...call, error: error.message, success: false });
        
        // Stop chain on error unless continueOnError is set
        if (!call.continueOnError) {
          break;
        }
      }
    }
    
    return results;
  }

  /**
   * Get execution history
   */
  getExecutionLog(limit = 100) {
    return this.executionLog.slice(-limit);
  }

  /**
   * Get execution statistics
   */
  getStats() {
    const total = this.executionLog.length;
    const successful = this.executionLog.filter(e => e.success).length;
    const failed = total - successful;
    
    const avgExecutionTime = total > 0
      ? this.executionLog.reduce((sum, e) => sum + e.executionTime, 0) / total
      : 0;
    
    const toolUsage = {};
    for (const entry of this.executionLog) {
      toolUsage[entry.toolName] = (toolUsage[entry.toolName] || 0) + 1;
    }
    
    return {
      total,
      successful,
      failed,
      successRate: total > 0 ? (successful / total) * 100 : 0,
      avgExecutionTime,
      toolUsage,
    };
  }

  /**
   * Clear execution log
   */
  clearLog() {
    this.executionLog = [];
  }

  /**
   * Log execution
   */
  _logExecution(entry) {
    this.executionLog.push({
      ...entry,
      timestamp: Date.now(),
    });
    
    // Keep only last 1000 entries
    if (this.executionLog.length > 1000) {
      this.executionLog = this.executionLog.slice(-1000);
    }
  }

  /**
   * Delay helper
   */
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton instance
let executorInstance = null;

/**
 * Get or create Tool Executor instance
 */
function getToolExecutor(options = {}) {
  if (!executorInstance) {
    executorInstance = new ToolExecutor(options);
  }
  return executorInstance;
}

module.exports = {
  ToolExecutor,
  getToolExecutor,
};
