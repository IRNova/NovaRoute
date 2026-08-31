import { getAdapter } from "../driver.js";

export async function createToken({ name, amount, unit = "tokens", expiresDays = 30, createdBy = "admin" }) {
  const db = await getAdapter();
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  // Generate a friendly 16-char code: NV-XXXX-XXXX-XXXX
  const raw = Math.random().toString(36).substring(2, 14).toUpperCase();
  const code = `NV-${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
  const createdAt = new Date().toISOString();
  const expiresAt = expiresDays ? new Date(Date.now() + expiresDays * 86400000).toISOString() : null;

  db.run(
    `INSERT INTO redeemTokens (id, code, name, amount, unit, status, createdBy, createdAt, expiresAt)
     VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?)`,
    [id, code, name, amount, unit, createdBy, createdAt, expiresAt]
  );
  return { id, code };
}

export async function listTokens() {
  const db = await getAdapter();
  return db.all(`SELECT * FROM redeemTokens ORDER BY createdAt DESC`);
}

export async function getTokenByCode(code) {
  const db = await getAdapter();
  return db.get(`SELECT * FROM redeemTokens WHERE code = ?`, [code]);
}

export async function redeemToken(code, apiKeyId) {
  const db = await getAdapter();
  const now = new Date().toISOString();
  const token = db.get(`SELECT * FROM redeemTokens WHERE code = ? AND status = 'active'`, [code]);
  
  if (!token) throw new Error("Token not found or already used");
  if (token.expiresAt && token.expiresAt < now) {
    db.run(`UPDATE redeemTokens SET status = 'expired' WHERE id = ?`, [token.id]);
    throw new Error("Token has expired");
  }

  db.transaction(() => {
    db.run(
      `UPDATE redeemTokens SET status = 'redeemed', redeemedAt = ?, redeemedKey = ? WHERE id = ?`,
      [now, apiKeyId, token.id]
    );
    // In a real system, we'd credit the API key's balance here.
    // For NovaRoute, we just record the redemption.
  });
  
  return token;
}

export async function revokeToken(id) {
  const db = await getAdapter();
  db.run(`UPDATE redeemTokens SET status = 'revoked' WHERE id = ?`, [id]);
}

export async function deleteToken(id) {
  const db = await getAdapter();
  db.run(`DELETE FROM redeemTokens WHERE id = ?`, [id]);
}
