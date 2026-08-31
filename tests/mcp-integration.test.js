/**
 * MCP Integration Tests
 * 
 * Tests for the integrated MCP system:
 * - MCP Server Manager
 * - Tool Discovery
 * - Tool Execution
 * - Smart Router
 * - Session Manager
 */

import { describe, it, expect, beforeEach } from "vitest";
import { McpServerManager } from "../src/lib/mcp/mcpServerManager.js";
import { ToolDiscovery } from "../src/lib/mcp/toolDiscovery.js";
import { ToolExecutor } from "../src/lib/mcp/toolExecution.js";
import { SmartRouter } from "../open-sse/routing/smartRouter.js";
import { SessionManager } from "../src/lib/mcp/sessionManager.js";
import { ConversationSession } from "../src/lib/mcp/sessionManager.js";

describe("MCP Server Manager", () => {
  let manager;

  beforeEach(() => {
    manager = new McpServerManager({ dataDir: "/tmp/test-mcp" });
  });

  it("should get catalog", () => {
    const catalog = manager.getCatalog();
    expect(catalog).toBeDefined();
    expect(Array.isArray(catalog)).toBe(true);
    expect(catalog.length).toBeGreaterThan(0);
  });

  it("should install a server", async () => {
    const server = await manager.installServer("exa");
    expect(server).toBeDefined();
    expect(server.id).toBe("exa");
    expect(server.status).toBe("installed");
  });

  it("should uninstall a server", async () => {
    await manager.installServer("exa");
    const result = await manager.uninstallServer("exa");
    expect(result.removed).toBe(true);
  });

  it("should list installed servers", async () => {
    await manager.installServer("exa");
    await manager.installServer("tavily");
    
    const servers = manager.listInstalledServers();
    expect(servers.length).toBe(2);
  });

  it("should discover tools", async () => {
    await manager.installServer("exa");
    const tools = await manager.discoverTools("exa");
    expect(tools).toBeDefined();
    expect(Array.isArray(tools)).toBe(true);
  });
});

describe("Tool Discovery", () => {
  let discovery;
  let manager;

  beforeEach(() => {
    manager = new McpServerManager({ dataDir: "/tmp/test-mcp" });
    discovery = new ToolDiscovery({ manager });
  });

  it("should discover all tools", async () => {
    await manager.installServer("exa");
    await manager.installServer("tavily");
    
    const tools = await discovery.discoverAll();
    expect(tools).toBeDefined();
    expect(tools.length).toBeGreaterThan(0);
  });

  it("should search tools", async () => {
    await manager.installServer("exa");
    await discovery.discoverAll();
    
    const results = discovery.searchTools("search");
    expect(results).toBeDefined();
    expect(Array.isArray(results)).toBe(true);
  });

  it("should get tool definitions for LLM", async () => {
    await manager.installServer("exa");
    await discovery.discoverAll();
    
    const definitions = discovery.getToolDefinitionsForLLM();
    expect(definitions).toBeDefined();
    expect(Array.isArray(definitions)).toBe(true);
    expect(definitions[0].type).toBe("function");
  });
});

describe("Tool Executor", () => {
  let executor;
  let manager;

  beforeEach(() => {
    manager = new McpServerManager({ dataDir: "/tmp/test-mcp" });
    executor = new ToolExecutor({ manager });
  });

  it("should execute a tool", async () => {
    await manager.installServer("exa");
    
    // Mock the executeTool method
    manager.executeTool = async () => ({
      content: [{ type: "text", text: "test result" }],
    });
    
    const result = await executor.execute("web_search_exa", { query: "test" });
    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
  });

  it("should get execution stats", async () => {
    const stats = executor.getStats();
    expect(stats).toBeDefined();
    expect(stats.total).toBe(0);
  });
});

describe("Smart Router", () => {
  let router;

  beforeEach(() => {
    router = new SmartRouter();
  });

  it("should route a request", async () => {
    const request = {
      model: "gpt-4",
      inputTokens: 100,
      outputTokens: 50,
    };

    const providers = [
      { provider: "openai", model: "gpt-4" },
      { provider: "anthropic", model: "claude-3-sonnet" },
    ];

    const selected = await router.route(request, providers);
    expect(selected).toBeDefined();
    expect(selected.provider).toBeDefined();
  });

  it("should update strategy", () => {
    router.setStrategy("cost");
    expect(router.routingStrategy).toBe("cost");
  });

  it("should get stats", () => {
    const stats = router.getStats();
    expect(stats).toBeDefined();
    expect(stats.totalRoutings).toBe(0);
  });
});

describe("Session Manager", () => {
  let manager;

  beforeEach(() => {
    manager = new SessionManager({ dataDir: "/tmp/test-sessions" });
  });

  it("should create a session", () => {
    const session = manager.createSession({
      agentId: "test-agent",
      provider: "openai",
      model: "gpt-4",
    });

    expect(session).toBeDefined();
    expect(session.id).toBeDefined();
    expect(session.agentId).toBe("test-agent");
  });

  it("should get a session", () => {
    const session = manager.createSession({ agentId: "test" });
    const retrieved = manager.getSession(session.id);
    expect(retrieved).toBeDefined();
    expect(retrieved.id).toBe(session.id);
  });

  it("should list sessions", () => {
    manager.createSession({ agentId: "agent1" });
    manager.createSession({ agentId: "agent2" });

    const sessions = manager.listSessions();
    expect(sessions.length).toBe(2);
  });

  it("should delete a session", () => {
    const session = manager.createSession({ agentId: "test" });
    const deleted = manager.deleteSession(session.id);
    expect(deleted).toBe(true);
  });

  it("should get stats", () => {
    manager.createSession({ agentId: "test" });
    const stats = manager.getStats();
    expect(stats.totalSessions).toBe(1);
  });
});

describe("Conversation Session", () => {
  let session;

  beforeEach(() => {
    session = new ConversationSession({
      agentId: "test-agent",
      provider: "openai",
      model: "gpt-4",
    });
  });

  it("should add user message", () => {
    const message = session.addUserMessage("Hello");
    expect(message).toBeDefined();
    expect(message.role).toBe("user");
    expect(message.content).toBe("Hello");
  });

  it("should add assistant message", () => {
    const message = session.addAssistantMessage("Hi there!");
    expect(message).toBeDefined();
    expect(message.role).toBe("assistant");
  });

  it("should get messages for LLM", () => {
    session.addUserMessage("Hello");
    session.addAssistantMessage("Hi!");

    const messages = session.getMessagesForLLM();
    expect(messages.length).toBe(2);
    expect(messages[0].role).toBe("user");
    expect(messages[1].role).toBe("assistant");
  });

  it("should estimate tokens", () => {
    session.addUserMessage("Hello world");
    const tokens = session.getEstimatedTokens();
    expect(tokens).toBeGreaterThan(0);
  });

  it("should export to JSON", () => {
    session.addUserMessage("Test");
    const json = session.toJSON();
    expect(json).toBeDefined();
    expect(json.messages.length).toBe(1);
  });

  it("should import from JSON", () => {
    const json = {
      id: "test-id",
      agentId: "test",
      messages: [{ role: "user", content: "Hello" }],
    };
    const imported = ConversationSession.fromJSON(json);
    expect(imported.id).toBe("test-id");
    expect(imported.messages.length).toBe(1);
  });
});
