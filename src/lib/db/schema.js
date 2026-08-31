// ⚠️ AGENT/DEV: Bump this by +1 EVERY TIME you change the schema below
// (add/remove/alter a table, column, or index in TABLES). It drives the
// pre-change safety backup in migrate.js: when the stored version is lower,
// one lightweight DB backup is taken before applying schema changes. Forgetting
// to bump only skips that backup — it does NOT break the additive auto-sync.
export const SCHEMA_VERSION = 4;

export const PRAGMA_SQL = `
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA temp_store = MEMORY;
PRAGMA mmap_size = 30000000;
PRAGMA cache_size = -64000;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;
`;

// Declarative current schema. Used by syncSchemaFromTables() to
// auto-add missing tables/columns/indexes after versioned migrations.
// For destructive changes (drop/rename/type-change), write a migration file.
export const TABLES = {
  _meta: {
    columns: {
      key: "TEXT PRIMARY KEY",
      value: "TEXT NOT NULL",
    },
  },
  settings: {
    columns: {
      id: "INTEGER PRIMARY KEY CHECK (id = 1)",
      data: "TEXT NOT NULL",
    },
  },
  providerConnections: {
    columns: {
      id: "TEXT PRIMARY KEY",
      provider: "TEXT NOT NULL",
      authType: "TEXT NOT NULL",
      name: "TEXT",
      email: "TEXT",
      priority: "INTEGER",
      isActive: "INTEGER DEFAULT 1",
      data: "TEXT NOT NULL",
      createdAt: "TEXT NOT NULL",
      updatedAt: "TEXT NOT NULL",
    },
    indexes: [
      "CREATE INDEX IF NOT EXISTS idx_pc_provider ON providerConnections(provider)",
      "CREATE INDEX IF NOT EXISTS idx_pc_provider_active ON providerConnections(provider, isActive)",
      "CREATE INDEX IF NOT EXISTS idx_pc_priority ON providerConnections(provider, priority)",
    ],
  },
  providerNodes: {
    columns: {
      id: "TEXT PRIMARY KEY",
      type: "TEXT",
      name: "TEXT",
      data: "TEXT NOT NULL",
      createdAt: "TEXT NOT NULL",
      updatedAt: "TEXT NOT NULL",
    },
    indexes: ["CREATE INDEX IF NOT EXISTS idx_pn_type ON providerNodes(type)"],
  },
  proxyPools: {
    columns: {
      id: "TEXT PRIMARY KEY",
      isActive: "INTEGER DEFAULT 1",
      testStatus: "TEXT",
      data: "TEXT NOT NULL",
      createdAt: "TEXT NOT NULL",
      updatedAt: "TEXT NOT NULL",
    },
    indexes: [
      "CREATE INDEX IF NOT EXISTS idx_pp_active ON proxyPools(isActive)",
      "CREATE INDEX IF NOT EXISTS idx_pp_status ON proxyPools(testStatus)",
    ],
  },
  users: {
    columns: {
      id: "TEXT PRIMARY KEY",
      username: "TEXT UNIQUE NOT NULL",
      passwordHash: "TEXT NOT NULL",
      role: "TEXT NOT NULL DEFAULT 'operator'",
      isActive: "INTEGER DEFAULT 1",
      createdAt: "TEXT NOT NULL",
      lastLoginAt: "TEXT",
    },
    indexes: [],
  },
  apiKeys: {
    columns: {
      id: "TEXT PRIMARY KEY",
      key: "TEXT UNIQUE NOT NULL",
      name: "TEXT",
      machineId: "TEXT",
      isActive: "INTEGER DEFAULT 1",
      createdAt: "TEXT NOT NULL",
      scopes: "TEXT",
      noLog: "INTEGER DEFAULT 0",
      allowUsageCommand: "INTEGER DEFAULT 0",
      usageLimitEnabled: "INTEGER DEFAULT 0",
      dailyUsageLimitUsd: "REAL",
      weeklyUsageLimitUsd: "REAL",
      allowedModels: "TEXT",
      blockedModels: "TEXT",
      modelAccessMode: "TEXT DEFAULT 'all'",
      rpmLimit: "INTEGER",
      concurrencyLimit: "INTEGER",
    },
    indexes: ["CREATE INDEX IF NOT EXISTS idx_ak_key ON apiKeys(key)"],
  },
  keyGroups: {
    columns: {
      id: "TEXT PRIMARY KEY",
      name: "TEXT NOT NULL",
      description: "TEXT DEFAULT ''",
      isActive: "INTEGER DEFAULT 1",
      createdAt: "TEXT NOT NULL",
      updatedAt: "TEXT NOT NULL",
    },
  },
  keyGroupPermissions: {
    columns: {
      id: "TEXT PRIMARY KEY",
      groupId: "TEXT NOT NULL",
      modelPattern: "TEXT NOT NULL",
      provider: "TEXT",
      accessType: "TEXT NOT NULL",
      createdAt: "TEXT NOT NULL",
    },
    indexes: ["CREATE INDEX IF NOT EXISTS idx_kgp_group ON keyGroupPermissions(groupId)"],
  },
  keyGroupMembers: {
    columns: {
      keyId: "TEXT NOT NULL",
      groupId: "TEXT NOT NULL",
      createdAt: "TEXT NOT NULL",
    },
    primaryKey: "PRIMARY KEY (keyId, groupId)",
    indexes: [
      "CREATE INDEX IF NOT EXISTS idx_kgm_group ON keyGroupMembers(groupId)",
      "CREATE INDEX IF NOT EXISTS idx_kgm_key ON keyGroupMembers(keyId)",
    ],
  },
  combos: {
    columns: {
      id: "TEXT PRIMARY KEY",
      name: "TEXT UNIQUE NOT NULL",
      kind: "TEXT",
      models: "TEXT NOT NULL",
      createdAt: "TEXT NOT NULL",
      updatedAt: "TEXT NOT NULL",
    },
    indexes: ["CREATE INDEX IF NOT EXISTS idx_combo_name ON combos(name)"],
  },
  kv: {
    columns: {
      scope: "TEXT NOT NULL",
      key: "TEXT NOT NULL",
      value: "TEXT NOT NULL",
    },
    primaryKey: "PRIMARY KEY (scope, key)",
    indexes: ["CREATE INDEX IF NOT EXISTS idx_kv_scope ON kv(scope)"],
  },
  usageHistory: {
    columns: {
      id: "INTEGER PRIMARY KEY AUTOINCREMENT",
      timestamp: "TEXT NOT NULL",
      provider: "TEXT",
      model: "TEXT",
      connectionId: "TEXT",
      apiKey: "TEXT",
      endpoint: "TEXT",
      promptTokens: "INTEGER DEFAULT 0",
      completionTokens: "INTEGER DEFAULT 0",
      cost: "REAL DEFAULT 0",
      status: "TEXT",
      tokens: "TEXT",
      meta: "TEXT",
    },
    indexes: [
      "CREATE INDEX IF NOT EXISTS idx_uh_ts ON usageHistory(timestamp DESC)",
      "CREATE INDEX IF NOT EXISTS idx_uh_provider ON usageHistory(provider)",
      "CREATE INDEX IF NOT EXISTS idx_uh_model ON usageHistory(model)",
      "CREATE INDEX IF NOT EXISTS idx_uh_conn ON usageHistory(connectionId)",
    ],
  },
  usageDaily: {
    columns: {
      dateKey: "TEXT PRIMARY KEY",
      data: "TEXT NOT NULL",
    },
  },
  requestDetails: {
    columns: {
      id: "TEXT PRIMARY KEY",
      timestamp: "TEXT NOT NULL",
      provider: "TEXT",
      model: "TEXT",
      connectionId: "TEXT",
      status: "TEXT",
      data: "TEXT NOT NULL",
    },
    indexes: [
      "CREATE INDEX IF NOT EXISTS idx_rd_ts ON requestDetails(timestamp DESC)",
      "CREATE INDEX IF NOT EXISTS idx_rd_provider ON requestDetails(provider)",
      "CREATE INDEX IF NOT EXISTS idx_rd_model ON requestDetails(model)",
      "CREATE INDEX IF NOT EXISTS idx_rd_conn ON requestDetails(connectionId)",
    ],
  },
  routingStats: {
    columns: {
      taskType: "TEXT NOT NULL",
      provider: "TEXT NOT NULL",
      model: "TEXT NOT NULL",
      samples: "INTEGER DEFAULT 0",
      success: "INTEGER DEFAULT 0",
      totalLatencyMs: "REAL DEFAULT 0",
      totalPromptTokens: "INTEGER DEFAULT 0",
      totalCompletionTokens: "INTEGER DEFAULT 0",
      totalCost: "REAL DEFAULT 0",
      lastUsed: "TEXT",
      updatedAt: "TEXT NOT NULL",
    },
    primaryKey: "PRIMARY KEY (taskType, provider, model)",
    indexes: [
      "CREATE INDEX IF NOT EXISTS idx_rs_task ON routingStats(taskType)",
      "CREATE INDEX IF NOT EXISTS idx_rs_provider ON routingStats(provider)",
    ],
  },
  semanticCache: {
    columns: {
      id: "TEXT PRIMARY KEY",
      model: "TEXT NOT NULL",
      endpoint: "TEXT",
      requestHash: "TEXT NOT NULL",
      embedding: "TEXT NOT NULL",
      response: "TEXT NOT NULL",
      responseFormat: "TEXT DEFAULT 'openai'",
      stream: "INTEGER DEFAULT 0",
      created: "TEXT NOT NULL",
      expiresAt: "TEXT",
      hits: "INTEGER DEFAULT 0",
    },
    indexes: [
      "CREATE INDEX IF NOT EXISTS idx_sc_model ON semanticCache(model)",
      "CREATE INDEX IF NOT EXISTS idx_sc_expires ON semanticCache(expiresAt)",
    ],
  },
  routingTimeline: {
    columns: {
      hour: "TEXT NOT NULL",
      taskType: "TEXT NOT NULL",
      provider: "TEXT NOT NULL",
      model: "TEXT NOT NULL",
      requests: "INTEGER DEFAULT 0",
      failures: "INTEGER DEFAULT 0",
      totalLatencyMs: "REAL DEFAULT 0",
    },
    primaryKey: "PRIMARY KEY (hour, taskType, provider, model)",
    indexes: [
      "CREATE INDEX IF NOT EXISTS idx_rt_hour ON routingTimeline(hour)",
      "CREATE INDEX IF NOT EXISTS idx_rt_provider ON routingTimeline(provider)",
    ],
  },
};

export function buildCreateTableSql(name, def) {
  const cols = Object.entries(def.columns).map(([k, v]) => `${k} ${v}`);
  if (def.primaryKey) cols.push(def.primaryKey);
  return `CREATE TABLE IF NOT EXISTS ${name} (${cols.join(", ")})`;
}
