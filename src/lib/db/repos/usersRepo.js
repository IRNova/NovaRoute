// Dashboard users. Before this the panel had a single shared password stored in
// `settings.password`; that value is migrated into an `admin` user (see
// migration 011) and still works, so nothing changes for a single-operator
// install until a second user is added.

import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { getAdapter } from "../driver.js";
import { normalizeRole } from "@/lib/auth/roles.js";

function parseFlag(value) {
  return value === 1 || value === true || value === "1";
}

function rowToUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    role: normalizeRole(row.role),
    isActive: parseFlag(row.isActive),
    createdAt: row.createdAt,
    lastLoginAt: row.lastLoginAt || null,
  };
}

export async function listUsers() {
  const db = await getAdapter();
  try {
    return db.all(`SELECT * FROM users ORDER BY createdAt ASC`).map(rowToUser);
  } catch {
    return [];
  }
}

export async function countUsers() {
  const db = await getAdapter();
  try {
    return db.get(`SELECT COUNT(*) AS c FROM users`)?.c ?? 0;
  } catch {
    return 0;
  }
}

export async function countActiveAdmins() {
  const db = await getAdapter();
  try {
    return db.get(`SELECT COUNT(*) AS c FROM users WHERE role = 'admin' AND isActive != 0`)?.c ?? 0;
  } catch {
    return 0;
  }
}

export async function getUserById(id) {
  const db = await getAdapter();
  try {
    return rowToUser(db.get(`SELECT * FROM users WHERE id = ?`, [id]));
  } catch {
    return null;
  }
}

export async function getUserByUsername(username) {
  const db = await getAdapter();
  try {
    return rowToUser(db.get(`SELECT * FROM users WHERE lower(username) = lower(?)`, [String(username || "")]));
  } catch {
    return null;
  }
}

/**
 * Verify a username/password pair.
 * @returns {Promise<object|null>} the user, or null when the pair is wrong or
 *          the account is disabled.
 */
export async function verifyUserPassword(username, password) {
  if (typeof password !== "string" || !password) return null;
  const db = await getAdapter();
  let row;
  try {
    row = db.get(`SELECT * FROM users WHERE lower(username) = lower(?)`, [String(username || "")]);
  } catch {
    return null;
  }
  if (!row || !parseFlag(row.isActive) || !row.passwordHash) return null;
  const ok = await bcrypt.compare(password, row.passwordHash);
  return ok ? rowToUser(row) : null;
}

/**
 * Find the account a bare password belongs to (legacy single-password login).
 * Only admin accounts are considered, so adding an operator never turns their
 * password into a passwordless-username login for the whole panel.
 */
export async function findAdminByPassword(password) {
  if (typeof password !== "string" || !password) return null;
  const db = await getAdapter();
  let rows;
  try {
    rows = db.all(`SELECT * FROM users WHERE role = 'admin' AND isActive != 0 ORDER BY createdAt ASC`);
  } catch {
    return null;
  }
  for (const row of rows || []) {
    if (!row.passwordHash) continue;
    // Sequential on purpose: admin accounts are few, and bcrypt is CPU-bound.
    if (await bcrypt.compare(password, row.passwordHash)) return rowToUser(row);
  }
  return null;
}

export async function createUser({ username, password, role = "operator", isActive = true }) {
  const name = String(username || "").trim();
  if (!name) throw new Error("username is required");
  if (!/^[A-Za-z0-9._-]{2,32}$/.test(name)) {
    throw new Error("username must be 2-32 characters (letters, digits, dot, underscore, hyphen)");
  }
  if (typeof password !== "string" || password.length < 6) {
    throw new Error("password must be at least 6 characters");
  }
  if (await getUserByUsername(name)) throw new Error("that username already exists");

  const db = await getAdapter();
  const user = {
    id: uuidv4(),
    username: name,
    passwordHash: await bcrypt.hash(password, 10),
    role: normalizeRole(role),
    isActive: isActive !== false,
    createdAt: new Date().toISOString(),
  };
  db.run(
    `INSERT INTO users(id, username, passwordHash, role, isActive, createdAt) VALUES(?, ?, ?, ?, ?, ?)`,
    [user.id, user.username, user.passwordHash, user.role, user.isActive ? 1 : 0, user.createdAt]
  );
  return rowToUser({ ...user, isActive: user.isActive ? 1 : 0 });
}

export async function updateUser(id, patch = {}) {
  const db = await getAdapter();
  const existing = db.get(`SELECT * FROM users WHERE id = ?`, [id]);
  if (!existing) return null;

  const next = {
    role: patch.role !== undefined ? normalizeRole(patch.role) : existing.role,
    isActive: patch.isActive !== undefined ? (patch.isActive ? 1 : 0) : existing.isActive,
    passwordHash: existing.passwordHash,
  };

  if (typeof patch.password === "string" && patch.password) {
    if (patch.password.length < 6) throw new Error("password must be at least 6 characters");
    next.passwordHash = await bcrypt.hash(patch.password, 10);
  }

  // Never leave the panel without a way in.
  const losingAdmin =
    parseFlag(existing.isActive) &&
    existing.role === "admin" &&
    (next.role !== "admin" || !next.isActive);
  if (losingAdmin && (await countActiveAdmins()) <= 1) {
    throw new Error("this is the last active admin account");
  }

  db.run(`UPDATE users SET role = ?, isActive = ?, passwordHash = ? WHERE id = ?`, [
    next.role,
    next.isActive,
    next.passwordHash,
    id,
  ]);
  return rowToUser(db.get(`SELECT * FROM users WHERE id = ?`, [id]));
}

export async function deleteUser(id) {
  const db = await getAdapter();
  const existing = db.get(`SELECT * FROM users WHERE id = ?`, [id]);
  if (!existing) return false;
  if (existing.role === "admin" && parseFlag(existing.isActive) && (await countActiveAdmins()) <= 1) {
    throw new Error("this is the last active admin account");
  }
  db.run(`DELETE FROM users WHERE id = ?`, [id]);
  return true;
}

/**
 * Keep the shared dashboard password and the built-in `admin` account in sync.
 *
 * The panel supports both: a legacy single password (settings.password) and
 * named accounts. Whenever the shared password is set, the admin row is created
 * or updated with the same hash, so an install that started single-user ends up
 * with a real identity to attach sessions, roles and the audit trail to.
 */
export async function syncAdminAccount(passwordHash, username = "admin") {
  if (typeof passwordHash !== "string" || !passwordHash) return null;
  const db = await getAdapter();
  try {
    const existing = db.get(`SELECT * FROM users WHERE lower(username) = lower(?)`, [username]);
    if (existing) {
      db.run(`UPDATE users SET passwordHash = ?, role = 'admin', isActive = 1 WHERE id = ?`, [
        passwordHash,
        existing.id,
      ]);
      return rowToUser(db.get(`SELECT * FROM users WHERE id = ?`, [existing.id]));
    }
    const id = uuidv4();
    db.run(
      `INSERT INTO users(id, username, passwordHash, role, isActive, createdAt) VALUES(?, ?, ?, 'admin', 1, ?)`,
      [id, username, passwordHash, new Date().toISOString()]
    );
    return rowToUser(db.get(`SELECT * FROM users WHERE id = ?`, [id]));
  } catch {
    return null; // never block a password change over the user table
  }
}

export async function recordLogin(id) {
  const db = await getAdapter();
  try {
    db.run(`UPDATE users SET lastLoginAt = ? WHERE id = ?`, [new Date().toISOString(), id]);
  } catch { /* best effort */ }
}
