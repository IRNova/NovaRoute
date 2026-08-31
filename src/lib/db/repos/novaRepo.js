import { v4 as uuidv4 } from "uuid";
import { getAdapter } from "../driver.js";
import { parseJson, stringifyJson } from "../helpers/jsonCol.js";
import { makeKv } from "../helpers/kvStore.js";

function rowToAgent(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    role: row.role || "employee",
    specialty: row.specialty || "",
    systemPrompt: row.systemPrompt || "",
    providerId: row.providerId || "",
    modelId: row.modelId || "",
    modelName: row.modelName || "",
    status: row.status || "active",
    color: row.color || null,
    icon: row.icon || null,
    tools: row.tools || "",
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    lastActiveAt: row.lastActiveAt,
  };
}

export async function getNovaAgents() {
  const db = await getAdapter();
  const rows = db.all(`SELECT * FROM novaAgents ORDER BY createdAt ASC`);
  return rows.map(rowToAgent);
}

export async function getNovaAgentById(id) {
  const db = await getAdapter();
  return rowToAgent(db.get(`SELECT * FROM novaAgents WHERE id = ?`, [id]));
}

export async function getNovaAgentsByRole(role) {
  const db = await getAdapter();
  const rows = db.all(`SELECT * FROM novaAgents WHERE role = ? ORDER BY createdAt ASC`, [role]);
  return rows.map(rowToAgent);
}

export async function createNovaAgent(data) {
  const db = await getAdapter();
  const now = new Date().toISOString();
  const agent = {
    id: uuidv4(),
    name: data.name,
    role: data.role || "employee",
    specialty: data.specialty || "",
    systemPrompt: data.systemPrompt || "",
    providerId: data.providerId || "",
    modelId: data.modelId || "",
    modelName: data.modelName || "",
    status: data.status || "active",
    color: data.color || null,
    icon: data.icon || null,
    tools: data.tools || "",
    createdAt: now,
    updatedAt: now,
    lastActiveAt: null,
  };
  db.run(
    `INSERT INTO novaAgents(id, name, role, specialty, systemPrompt, providerId, modelId, modelName, status, color, icon, tools, createdAt, updatedAt, lastActiveAt)
     VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [agent.id, agent.name, agent.role, agent.specialty, agent.systemPrompt, agent.providerId, agent.modelId, agent.modelName, agent.status, agent.color, agent.icon, agent.tools, agent.createdAt, agent.updatedAt, agent.lastActiveAt]
  );
  return agent;
}

export async function updateNovaAgent(id, data) {
  const db = await getAdapter();
  let result = null;
  db.transaction(() => {
    const row = db.get(`SELECT * FROM novaAgents WHERE id = ?`, [id]);
    if (!row) return;
    const merged = { ...rowToAgent(row), ...data, updatedAt: new Date().toISOString() };
    db.run(
      `UPDATE novaAgents SET name = ?, role = ?, specialty = ?, systemPrompt = ?, providerId = ?, modelId = ?, modelName = ?, status = ?, color = ?, icon = ?, tools = ?, updatedAt = ? WHERE id = ?`,
      [merged.name, merged.role, merged.specialty, merged.systemPrompt, merged.providerId, merged.modelId, merged.modelName, merged.status, merged.color, merged.icon, merged.tools, merged.updatedAt, id]
    );
    result = merged;
  });
  return result;
}

export async function deleteNovaAgent(id) {
  const db = await getAdapter();
  const res = db.run(`DELETE FROM novaAgents WHERE id = ?`, [id]);
  return (res?.changes ?? 0) > 0;
}

export async function touchNovaAgent(id) {
  const db = await getAdapter();
  db.run(`UPDATE novaAgents SET lastActiveAt = ? WHERE id = ?`, [new Date().toISOString(), id]);
}

// Sessions

function rowToSession(row) {
  if (!row) return null;
  return { id: row.id, title: row.title || "", createdAt: row.createdAt, updatedAt: row.updatedAt };
}

export async function getNovaSessions() {
  const db = await getAdapter();
  return db.all(`SELECT * FROM novaSessions ORDER BY updatedAt DESC`).map(rowToSession);
}

export async function getNovaSessionById(id) {
  const db = await getAdapter();
  return rowToSession(db.get(`SELECT * FROM novaSessions WHERE id = ?`, [id]));
}

export async function createNovaSession(title = "") {
  const db = await getAdapter();
  const now = new Date().toISOString();
  const session = { id: uuidv4(), title: title || "New mission", createdAt: now, updatedAt: now };
  db.run(`INSERT INTO novaSessions(id, title, createdAt, updatedAt) VALUES(?, ?, ?, ?)`, [session.id, session.title, session.createdAt, session.updatedAt]);
  return session;
}

export async function updateNovaSession(id, data) {
  const db = await getAdapter();
  let result = null;
  db.transaction(() => {
    const row = db.get(`SELECT * FROM novaSessions WHERE id = ?`, [id]);
    if (!row) return;
    const merged = { ...rowToSession(row), ...data, updatedAt: new Date().toISOString() };
    db.run(`UPDATE novaSessions SET title = ?, updatedAt = ? WHERE id = ?`, [merged.title, merged.updatedAt, id]);
    result = merged;
  });
  return result;
}

export async function deleteNovaSession(id) {
  const db = await getAdapter();
  let ok = false;
  db.transaction(() => {
    db.run(`DELETE FROM novaMessages WHERE sessionId = ?`, [id]);
    db.run(`DELETE FROM novaTasks WHERE sessionId = ?`, [id]);
    const res = db.run(`DELETE FROM novaSessions WHERE id = ?`, [id]);
    ok = (res?.changes ?? 0) > 0;
  });
  return ok;
}

// Messages

function rowToMessage(row) {
  if (!row) return null;
  return {
    id: row.id,
    sessionId: row.sessionId,
    agentId: row.agentId,
    agentName: row.agentName,
    agentRole: row.agentRole,
    role: row.role,
    type: row.type || "message",
    content: row.content,
    meta: parseJson(row.meta, null),
    createdAt: row.createdAt,
  };
}

export async function getNovaMessages(sessionId) {
  const db = await getAdapter();
  return db.all(`SELECT * FROM novaMessages WHERE sessionId = ? ORDER BY createdAt ASC`, [sessionId]).map(rowToMessage);
}

// Server-side full-text-ish search across every stored Nova message.
export async function searchNovaMessages(query, limit = 20) {
  const q = String(query || "").trim();
  if (!q) return [];
  const db = await getAdapter();
  const like = `%${q.replace(/[%_]/g, "!!")}%`;
  const rows = db.all(
    `SELECT m.id, m.sessionId, m.role, m.agentName, m.type, substr(m.content, 1, 300) AS excerpt,
            instr(lower(m.content), lower(?)) AS _pos, m.createdAt, s.title AS sessionTitle
       FROM novaMessages m LEFT JOIN novaSessions s ON s.id = m.sessionId
      WHERE m.content LIKE ? ESCAPE '!'
      ORDER BY m.createdAt DESC LIMIT ?`,
    [q, like, Number(limit) || 20]
  );
  return rows;
}

export async function createNovaMessage(data) {
  const db = await getAdapter();
  const message = {
    id: uuidv4(),
    sessionId: data.sessionId,
    agentId: data.agentId || null,
    agentName: data.agentName || null,
    agentRole: data.agentRole || null,
    role: data.role,
    type: data.type || "message",
    content: data.content ?? "",
    meta: data.meta || null,
    createdAt: new Date().toISOString(),
  };
  db.run(
    `INSERT INTO novaMessages(id, sessionId, agentId, agentName, agentRole, role, type, content, meta, createdAt) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [message.id, message.sessionId, message.agentId, message.agentName, message.agentRole, message.role, message.type, message.content, stringifyJson(message.meta), message.createdAt]
  );
  db.run(`UPDATE novaSessions SET updatedAt = ? WHERE id = ?`, [message.createdAt, message.sessionId]);
  return message;
}

// Tasks

function rowToTask(row) {
  if (!row) return null;
  return {
    id: row.id,
    sessionId: row.sessionId,
    fromAgentId: row.fromAgentId,
    fromAgentName: row.fromAgentName,
    toAgentId: row.toAgentId,
    toAgentName: row.toAgentName,
    instruction: row.instruction,
    result: row.result,
    status: row.status || "pending",
    reviewStatus: row.reviewStatus,
    reviewNote: row.reviewNote,
    durationMs: row.durationMs,
    createdAt: row.createdAt,
    completedAt: row.completedAt,
  };
}

export async function getNovaTasks(sessionId) {
  const db = await getAdapter();
  return db.all(`SELECT * FROM novaTasks WHERE sessionId = ? ORDER BY createdAt ASC`, [sessionId]).map(rowToTask);
}

export async function createNovaTask(data) {
  const db = await getAdapter();
  const task = {
    id: uuidv4(),
    sessionId: data.sessionId,
    fromAgentId: data.fromAgentId || null,
    fromAgentName: data.fromAgentName || null,
    toAgentId: data.toAgentId || null,
    toAgentName: data.toAgentName || null,
    instruction: data.instruction || "",
    result: null,
    status: "pending",
    reviewStatus: null,
    reviewNote: null,
    durationMs: null,
    createdAt: new Date().toISOString(),
    completedAt: null,
  };
  db.run(
    `INSERT INTO novaTasks(id, sessionId, fromAgentId, fromAgentName, toAgentId, toAgentName, instruction, status, createdAt) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [task.id, task.sessionId, task.fromAgentId, task.fromAgentName, task.toAgentId, task.toAgentName, task.instruction, task.status, task.createdAt]
  );
  return task;
}

export async function updateNovaTask(id, data) {
  const db = await getAdapter();
  let result = null;
  db.transaction(() => {
    const row = db.get(`SELECT * FROM novaTasks WHERE id = ?`, [id]);
    if (!row) return;
    const merged = { ...rowToTask(row), ...data };
    db.run(
      `UPDATE novaTasks SET result = ?, status = ?, reviewStatus = ?, reviewNote = ?, durationMs = ?, completedAt = ? WHERE id = ?`,
      [merged.result, merged.status, merged.reviewStatus, merged.reviewNote, merged.durationMs, merged.completedAt, id]
    );
    result = merged;
  });
  return result;
}

export async function getNovaSessionTranscript(sessionId) {
  const db = await getAdapter();
  const session = rowToSession(db.get(`SELECT * FROM novaSessions WHERE id = ?`, [sessionId]));
  if (!session) return null;
  return {
    session,
    messages: await getNovaMessages(sessionId),
    tasks: await getNovaTasks(sessionId),
  };
}

// Supervision stats — per-agent productivity across all sessions.
export async function getNovaStats() {
  const db = await getAdapter();
  const agents = (await getNovaAgents()).filter((a) => a.role === "employee" || a.role === "supervisor");
  const stats = agents.map((agent) => {
    const assigned = db.get(
      `SELECT COUNT(*) AS c FROM novaTasks WHERE toAgentId = ?`,
      [agent.id]
    )?.c || 0;
    const done = db.get(
      `SELECT COUNT(*) AS c FROM novaTasks WHERE toAgentId = ? AND status = 'done'`,
      [agent.id]
    )?.c || 0;
    const failed = db.get(
      `SELECT COUNT(*) AS c FROM novaTasks WHERE toAgentId = ? AND status = 'failed'`,
      [agent.id]
    )?.c || 0;
    const flagged = db.get(
      `SELECT COUNT(*) AS c FROM novaTasks WHERE toAgentId = ? AND reviewStatus = 'flagged'`,
      [agent.id]
    )?.c || 0;
    const avg = db.get(
      `SELECT AVG(durationMs) AS a FROM novaTasks WHERE toAgentId = ? AND durationMs IS NOT NULL`,
      [agent.id]
    )?.a || null;
    const reviewsDone = agent.role === "supervisor"
      ? db.get(`SELECT COUNT(*) AS c FROM novaTasks WHERE reviewStatus IS NOT NULL`)?.c || 0
      : 0;
    return {
      agentId: agent.id,
      name: agent.name,
      role: agent.role,
      status: agent.status,
      modelName: agent.modelName,
      assigned,
      done,
      failed,
      flagged,
      avgDurationMs: avg ? Math.round(avg) : null,
      reviewsDone,
      lastActiveAt: agent.lastActiveAt,
    };
  });
  return stats;
}

// Telegram bridge config — kv-backed singleton (no dedicated table needed).
const telegramKv = makeKv("novaTelegram");

const DEFAULT_TELEGRAM_CONFIG = {
  botToken: "",
  adminChatId: "",
  secretToken: "",
  enabled: false,
  mode: "webhook", // webhook | polling
  publicBaseUrl: "",
  telegramSessionId: "",
};

export async function getNovaTelegramConfig() {
  const stored = await telegramKv.get("config");
  return { ...DEFAULT_TELEGRAM_CONFIG, ...(stored && typeof stored === "object" ? stored : {}) };
}

export async function saveNovaTelegramConfig(patch) {
  const current = await getNovaTelegramConfig();
  const next = { ...current };
  for (const [key, value] of Object.entries(patch || {})) {
    if (key in DEFAULT_TELEGRAM_CONFIG) next[key] = value;
  }
  await telegramKv.set("config", next);
  return next;
}

// ── Instagram DM bridge config ──
const instagramKv = makeKv("novaInstagram");

const DEFAULT_INSTAGRAM_CONFIG = {
  pageAccessToken: "",
  pageId: "",
  verifyToken: "",
  appSecret: "",
  adminIgUserId: "",
  enabled: false,
  autoApproveAfterN: 0,
  alwaysReply: true,
  behaviorPrompt: "",
  blacklist: [],
};

export async function getNovaInstagramConfig() {
  const stored = await instagramKv.get("config");
  return { ...DEFAULT_INSTAGRAM_CONFIG, ...(stored && typeof stored === "object" ? stored : {}) };
}

export async function saveNovaInstagramConfig(patch) {
  const current = await getNovaInstagramConfig();
  const next = { ...current };
  for (const [key, value] of Object.entries(patch || {})) {
    if (key in DEFAULT_INSTAGRAM_CONFIG) next[key] = value;
  }
  await instagramKv.set("config", next);
  return next;
}
