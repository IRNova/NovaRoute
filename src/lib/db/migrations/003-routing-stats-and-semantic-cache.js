// Adaptive/predictive routing stats + semantic cache tables.
// routingStats: per (taskType, provider, model) rolling performance for the
// predictive scorer (success rate, EMA latency, token/cost averages).
// semanticCache: embedding-indexed request cache for the semantic cache feature.
export default {
  version: 3,
  name: "routing-stats-and-semantic-cache",
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS routingStats (
        taskType TEXT NOT NULL,
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        samples INTEGER DEFAULT 0,
        success INTEGER DEFAULT 0,
        totalLatencyMs REAL DEFAULT 0,
        totalPromptTokens INTEGER DEFAULT 0,
        totalCompletionTokens INTEGER DEFAULT 0,
        totalCost REAL DEFAULT 0,
        lastUsed TEXT,
        updatedAt TEXT NOT NULL,
        PRIMARY KEY (taskType, provider, model)
      );
      CREATE INDEX IF NOT EXISTS idx_rs_task ON routingStats(taskType);
      CREATE INDEX IF NOT EXISTS idx_rs_provider ON routingStats(provider);

      CREATE TABLE IF NOT EXISTS semanticCache (
        id TEXT PRIMARY KEY,
        model TEXT NOT NULL,
        endpoint TEXT,
        requestHash TEXT NOT NULL,
        embedding TEXT NOT NULL,
        response TEXT NOT NULL,
        responseFormat TEXT DEFAULT 'openai',
        stream INTEGER DEFAULT 0,
        created TEXT NOT NULL,
        expiresAt TEXT,
        hits INTEGER DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_sc_model ON semanticCache(model);
      CREATE INDEX IF NOT EXISTS idx_sc_expires ON semanticCache(expiresAt);
    `);
  },
};
