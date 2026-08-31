// Dashboard users and roles.
//
// The panel used to have one shared password in `settings.password`. That hash
// is carried over into an `admin` user so the existing login keeps working
// exactly as before; roles only start to matter once a second user is added.
//
// Installs that never set a password (the initial password lives in the
// INITIAL_PASSWORD environment variable) get no user row here: the legacy
// env-password path in the login route still lets the operator in, and the
// first password they set from the dashboard creates the admin account.
export default {
  version: 11,
  name: "users-and-roles",
  up(db) {
    db.exec(`CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      passwordHash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'operator',
      isActive INTEGER DEFAULT 1,
      createdAt TEXT NOT NULL,
      lastLoginAt TEXT
    )`);

    let existingUsers = 0;
    try {
      existingUsers = db.get(`SELECT COUNT(*) AS c FROM users`)?.c ?? 0;
    } catch {
      return;
    }
    if (existingUsers > 0) return;

    let settings = null;
    try {
      const row = db.get(`SELECT data FROM settings WHERE id = 1`);
      settings = row ? JSON.parse(row.data || "{}") : null;
    } catch {
      return; // fresh database: no settings table yet
    }

    const hash = settings?.password;
    if (typeof hash !== "string" || !hash) return;

    db.run(
      `INSERT INTO users(id, username, passwordHash, role, isActive, createdAt) VALUES(?, ?, ?, 'admin', 1, ?)`,
      [
        // Deterministic id so a re-run cannot create a second copy.
        "00000000-0000-4000-8000-000000000001",
        "admin",
        hash,
        new Date().toISOString(),
      ]
    );
  },
};
