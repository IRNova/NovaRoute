// Add expiresAt (ISO string, nullable) to apiKeys — optional key expiry.
export default {
  version: 8,
  name: "api-key-expiry",
  up(db) {
    try {
      db.exec(`ALTER TABLE apiKeys ADD COLUMN expiresAt TEXT`);
    } catch (e) {
      if (!/duplicate column/i.test(e?.message || "")) throw e;
    }
  },
};
