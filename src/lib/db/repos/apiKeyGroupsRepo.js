import { v4 as uuidv4 } from "uuid";
import { getAdapter } from "../driver.js";

function rowToGroup(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    description: row.description || "",
    isActive: row.isActive === 1 || row.isActive === true,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function rowToPermission(row) {
  if (!row) return null;
  return {
    id: row.id,
    groupId: row.groupId,
    modelPattern: row.modelPattern,
    provider: row.provider || null,
    accessType: row.accessType,
    createdAt: row.createdAt,
  };
}

export async function getAllKeyGroups() {
  const db = await getAdapter();
  const rows = db.all(`SELECT * FROM keyGroups ORDER BY name ASC`);
  return rows.map(rowToGroup);
}

export async function getKeyGroup(id) {
  const db = await getAdapter();
  const row = db.get(`SELECT * FROM keyGroups WHERE id = ?`, [id]);
  return rowToGroup(row);
}

export async function getKeyGroupWithPermissions(id) {
  const db = await getAdapter();
  const group = await getKeyGroup(id);
  if (!group) return null;
  const permissions = await getGroupPermissions(id);
  const row = db.get(`SELECT COUNT(*) as c FROM keyGroupMembers WHERE groupId = ?`, [id]);
  return { ...group, permissions, memberCount: row?.c || 0 };
}

export async function createKeyGroup(name, description = "") {
  const db = await getAdapter();
  const id = uuidv4();
  const now = new Date().toISOString();
  db.run(
    `INSERT INTO keyGroups(id, name, description, isActive, createdAt, updatedAt) VALUES(?, ?, ?, ?, ?, ?)`,
    [id, name, description || "", 1, now, now]
  );
  return getKeyGroup(id);
}

export async function updateKeyGroup(id, updates) {
  const existing = await getKeyGroup(id);
  if (!existing) return null;
  const db = await getAdapter();
  const sets = [];
  const params = { id };
  if (updates.name !== undefined) { sets.push("name = @name"); params.name = updates.name; }
  if (updates.description !== undefined) { sets.push("description = @description"); params.description = updates.description; }
  if (updates.isActive !== undefined) { sets.push("isActive = @isActive"); params.isActive = updates.isActive ? 1 : 0; }
  if (sets.length === 0) return existing;
  sets.push("updatedAt = @updatedAt");
  params.updatedAt = new Date().toISOString();
  db.run(`UPDATE keyGroups SET ${sets.join(", ")} WHERE id = @id`, [params]);
  return getKeyGroup(id);
}

export async function deleteKeyGroup(id) {
  const db = await getAdapter();
  const res = db.run(`DELETE FROM keyGroups WHERE id = ?`, [id]);
  if ((res?.changes ?? 0) > 0) {
    db.run(`DELETE FROM keyGroupPermissions WHERE groupId = ?`, [id]);
    db.run(`DELETE FROM keyGroupMembers WHERE groupId = ?`, [id]);
    return true;
  }
  return false;
}

export async function getGroupPermissions(groupId) {
  const db = await getAdapter();
  const rows = db.all(
    `SELECT * FROM keyGroupPermissions WHERE groupId = ? ORDER BY accessType ASC, modelPattern ASC`,
    [groupId]
  );
  return rows.map(rowToPermission);
}

export async function addGroupPermission(groupId, modelPattern, accessType, provider = null) {
  const db = await getAdapter();
  const id = uuidv4();
  const now = new Date().toISOString();
  db.run(
    `INSERT INTO keyGroupPermissions(id, groupId, modelPattern, provider, accessType, createdAt) VALUES(?, ?, ?, ?, ?, ?)`,
    [id, groupId, modelPattern, provider || null, accessType, now]
  );
  const row = db.get(`SELECT * FROM keyGroupPermissions WHERE id = ?`, [id]);
  return rowToPermission(row);
}

export async function removeGroupPermission(permissionId) {
  const db = await getAdapter();
  const res = db.run(`DELETE FROM keyGroupPermissions WHERE id = ?`, [permissionId]);
  return (res?.changes ?? 0) > 0;
}

export async function clearGroupPermissions(groupId) {
  const db = await getAdapter();
  db.run(`DELETE FROM keyGroupPermissions WHERE groupId = ?`, [groupId]);
}

export async function getGroupMembers(groupId) {
  const db = await getAdapter();
  const rows = db.all(`SELECT * FROM keyGroupMembers WHERE groupId = ? ORDER BY createdAt ASC`, [groupId]);
  return rows.map((r) => ({ keyId: r.keyId, groupId: r.groupId, createdAt: r.createdAt }));
}

export async function getKeyGroupsForApiKey(keyId) {
  const db = await getAdapter();
  const rows = db.all(
    `SELECT g.* FROM keyGroups g INNER JOIN keyGroupMembers m ON g.id = m.groupId WHERE m.keyId = ? AND g.isActive = 1 ORDER BY g.name ASC`,
    [keyId]
  );
  return rows.map(rowToGroup);
}

export async function addKeyToGroup(keyId, groupId) {
  const db = await getAdapter();
  try {
    db.run(
      `INSERT OR IGNORE INTO keyGroupMembers(keyId, groupId, createdAt) VALUES(?, ?, ?)`,
      [keyId, groupId, new Date().toISOString()]
    );
    return true;
  } catch {
    return false;
  }
}

export async function removeKeyFromGroup(keyId, groupId) {
  const db = await getAdapter();
  const res = db.run(`DELETE FROM keyGroupMembers WHERE keyId = ? AND groupId = ?`, [keyId, groupId]);
  return (res?.changes ?? 0) > 0;
}

function matchesModelPattern(pattern, model) {
  if (!pattern) return false;
  if (pattern === "*") return true;
  if (pattern.includes("*")) {
    try {
      const regex = new RegExp("^" + pattern.replace(/\*/g, ".*") + "$");
      return regex.test(model);
    } catch {
      return pattern === model;
    }
  }
  return pattern === model;
}

/**
 * Check if an API key has access to a specific model via its groups.
 * Deny rules override allow rules. If no rules match, access is allowed by default.
 */
export async function checkKeyModelAccess(keyId, model, provider = null) {
  const groups = await getKeyGroupsForApiKey(keyId);
  if (groups.length === 0) {
    return { allowed: true, matchedRules: [], deniedBy: null };
  }

  const db = await getAdapter();
  const groupIds = groups.map((g) => g.id);
  const placeholders = groupIds.map(() => "?").join(",");
  const rows = db.all(
    `SELECT * FROM keyGroupPermissions WHERE groupId IN (${placeholders}) ORDER BY accessType ASC`,
    groupIds
  );
  const permissions = rows.map(rowToPermission);

  const denyRules = permissions.filter(
    (p) =>
      p.accessType === "deny" &&
      matchesModelPattern(p.modelPattern, model) &&
      (!p.provider || p.provider === provider)
  );
  if (denyRules.length > 0) {
    return { allowed: false, matchedRules: permissions, deniedBy: denyRules[0] };
  }

  const allowRules = permissions.filter(
    (p) =>
      p.accessType === "allow" &&
      matchesModelPattern(p.modelPattern, model) &&
      (!p.provider || p.provider === provider)
  );
  if (allowRules.length > 0) {
    return { allowed: true, matchedRules: permissions, deniedBy: null };
  }

  return { allowed: false, matchedRules: permissions, deniedBy: null };
}
