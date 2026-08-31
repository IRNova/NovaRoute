// Per-agent system tools: "terminal" (root, admin-approved) and/or
// "browser" (headless Chromium). Comma-separated, empty = no access.
export default {
  version: 7,
  name: "agent-tools",
  up(db) {
    db.exec(`
      ALTER TABLE novaAgents ADD COLUMN tools TEXT DEFAULT '';
    `);
  },
};
