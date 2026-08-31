// Migration registry â€” append new entries when schema changes.
// Each migration: { version: number, name: string, up(db): void }
// Versions MUST be unique and monotonically increasing.
import m001 from "./001-initial.js";
import m002 from "./002-api-key-permissions.js";
import m003 from "./003-routing-stats-and-semantic-cache.js";
import m004 from "./004-routing-timeline.js";
import m005 from "./005-redeem-tokens.js";
import m006 from "./006-nova-bot.js";
import m007 from "./007-agent-tools.js";
import m008 from "./008-api-key-expiry.js";
import m009 from "./009-require-api-key-default.js";
import m010 from "./010-key-rate-limits.js";
import m011 from "./011-users-and-roles.js";

export const MIGRATIONS = [m001, m002, m003, m004, m005, m006, m007, m008, m009, m010, m011].sort((a, b) => a.version - b.version);

export function latestVersion() {
  return MIGRATIONS.length ? MIGRATIONS[MIGRATIONS.length - 1].version : 0;
}

