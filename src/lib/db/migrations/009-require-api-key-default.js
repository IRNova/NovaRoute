// The gateway used to default to `requireApiKey: false`, so a server installed
// with the published installer (0.0.0.0 + an opened firewall port) answered
// /v1 for anyone on the internet, spending the owner's provider credits.
//
// The default is now `true`. Flipping it must not silently break servers that
// have been running open on purpose, so this migration pins the OLD value on
// databases that already exist: if a settings row is present and never set the
// flag, it is written out as `false` and nothing changes for that install.
// Fresh installs have no settings row, so they get the secure default.
export default {
  version: 9,
  name: "require-api-key-default",
  up(db) {
    // Versioned migrations run before the additive schema sync, so on a brand
    // new database the settings table may not exist yet — that is the fresh
    // install case, which wants the secure default anyway.
    let row;
    try {
      row = db.get(`SELECT data FROM settings WHERE id = 1`);
    } catch {
      return;
    }
    if (!row) return; // fresh database → secure default applies

    let settings;
    try {
      settings = JSON.parse(row.data || "{}");
    } catch {
      return; // unreadable settings blob — leave it alone
    }
    if (!settings || typeof settings !== "object") return;
    if (Object.prototype.hasOwnProperty.call(settings, "requireApiKey")) return;

    settings.requireApiKey = false;
    db.run(`UPDATE settings SET data = ? WHERE id = 1`, [JSON.stringify(settings)]);
  },
};
