// Redeem tokens system for usage/credits.
export default {
  version: 5,
  name: "redeem-tokens",
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS redeemTokens (
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        name TEXT,
        amount INTEGER DEFAULT 0,
        unit TEXT DEFAULT 'tokens', -- tokens, requests, usd
        status TEXT DEFAULT 'active', -- active, redeemed, revoked, expired
        createdBy TEXT,
        createdAt TEXT NOT NULL,
        redeemedAt TEXT,
        redeemedKey TEXT,
        expiresAt TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_rt_code ON redeemTokens(code);
      CREATE INDEX IF NOT EXISTS idx_rt_status ON redeemTokens(status);
    `);
  },
};
