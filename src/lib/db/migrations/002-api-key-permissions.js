// API key permissions & key groups.
// Adds permission columns to apiKeys and the keyGroups / keyGroupPermissions /
// keyGroupMembers tables (team/enterprise key grouping with model-level access).
export default {
  version: 2,
  name: "api-key-permissions",
  up(db) {
    const hasColumn = (table, col) =>
      db.all(`PRAGMA table_info(${table})`).some((r) => r.name === col);

    const additions = {
      apiKeys: [
        ["scopes", "TEXT"],
        ["noLog", "INTEGER DEFAULT 0"],
        ["allowUsageCommand", "INTEGER DEFAULT 0"],
        ["usageLimitEnabled", "INTEGER DEFAULT 0"],
        ["dailyUsageLimitUsd", "REAL"],
        ["weeklyUsageLimitUsd", "REAL"],
        ["allowedModels", "TEXT"],
        ["blockedModels", "TEXT"],
        ["modelAccessMode", "TEXT DEFAULT 'all'"],
      ],
    };

    for (const [table, cols] of Object.entries(additions)) {
      for (const [name, def] of cols) {
        if (hasColumn(table, name)) continue;
        try {
          db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${def}`);
        } catch (e) {
          // Column may have been added by another node between the check and ALTER
          if (!String(e?.message || "").includes("duplicate column")) throw e;
        }
      }
    }

    db.exec(`
      CREATE TABLE IF NOT EXISTS keyGroups (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        isActive INTEGER DEFAULT 1,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS keyGroupPermissions (
        id TEXT PRIMARY KEY,
        groupId TEXT NOT NULL,
        modelPattern TEXT NOT NULL,
        provider TEXT,
        accessType TEXT NOT NULL,
        createdAt TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_kgp_group ON keyGroupPermissions(groupId);
      CREATE TABLE IF NOT EXISTS keyGroupMembers (
        keyId TEXT NOT NULL,
        groupId TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        PRIMARY KEY (keyId, groupId)
      );
      CREATE INDEX IF NOT EXISTS idx_kgm_group ON keyGroupMembers(groupId);
      CREATE INDEX IF NOT EXISTS idx_kgm_key ON keyGroupMembers(keyId);
    `);
  },
};
