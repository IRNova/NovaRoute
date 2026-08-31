// Nova Bot multi-agent system: agents (CEO/supervisor/employees),
// persistent sessions, inter-agent messages and delegation tasks.
export default {
  version: 6,
  name: "nova-bot",
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS novaAgents (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'employee', -- ceo, supervisor, employee
        specialty TEXT,
        systemPrompt TEXT,
        providerId TEXT,
        modelId TEXT,
        modelName TEXT,
        status TEXT DEFAULT 'active', -- active, inactive
        color TEXT,
        icon TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        lastActiveAt TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_nova_agents_role ON novaAgents(role);
      CREATE INDEX IF NOT EXISTS idx_nova_agents_status ON novaAgents(status);

      CREATE TABLE IF NOT EXISTS novaSessions (
        id TEXT PRIMARY KEY,
        title TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_nova_sessions_updated ON novaSessions(updatedAt);

      CREATE TABLE IF NOT EXISTS novaMessages (
        id TEXT PRIMARY KEY,
        sessionId TEXT NOT NULL,
        agentId TEXT,
        agentName TEXT,
        agentRole TEXT,
        role TEXT NOT NULL, -- user, agent, system
        type TEXT DEFAULT 'message', -- message, plan, report, review, error
        content TEXT NOT NULL,
        meta TEXT,
        createdAt TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_nova_messages_session ON novaMessages(sessionId);
      CREATE INDEX IF NOT EXISTS idx_nova_messages_created ON novaMessages(createdAt);

      CREATE TABLE IF NOT EXISTS novaTasks (
        id TEXT PRIMARY KEY,
        sessionId TEXT NOT NULL,
        fromAgentId TEXT,
        fromAgentName TEXT,
        toAgentId TEXT,
        toAgentName TEXT,
        instruction TEXT NOT NULL,
        result TEXT,
        status TEXT DEFAULT 'pending', -- pending, running, done, failed
        reviewStatus TEXT, -- approved, flagged
        reviewNote TEXT,
        durationMs INTEGER,
        createdAt TEXT NOT NULL,
        completedAt TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_nova_tasks_session ON novaTasks(sessionId);
      CREATE INDEX IF NOT EXISTS idx_nova_tasks_to_agent ON novaTasks(toAgentId);
    `);
  },
};
