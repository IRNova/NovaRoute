// Channel definitions survive a restart.
//
// The manager keeps live adapter instances in memory, which is right for
// sockets and clients, but it meant a configured channel vanished on every
// deploy. Definitions (type, name, config, credentials) are persisted here and
// replayed into the manager on first use.

import { makeKv } from "@/lib/db/helpers/kvStore.js";

const kv = makeKv("channels");
const KEY = "definitions";

export async function loadChannelDefinitions() {
  const list = await kv.get(KEY, []);
  return Array.isArray(list) ? list : [];
}

export async function saveChannelDefinition(def) {
  const list = await loadChannelDefinitions();
  const idx = list.findIndex((d) => d.id === def.id);
  if (idx >= 0) list[idx] = def;
  else list.push(def);
  await kv.set(KEY, list.slice(0, 50));
  return def;
}

export async function removeChannelDefinition(id) {
  const list = await loadChannelDefinitions();
  await kv.set(KEY, list.filter((d) => d.id !== id));
}

/**
 * Recreate persisted channels inside a manager that has none. Safe to call on
 * every request: it returns immediately once the manager holds channels.
 */
export async function restoreChannels(manager) {
  try {
    if (manager.channels?.size) return 0;
    const definitions = await loadChannelDefinitions();
    let restored = 0;
    for (const def of definitions) {
      try {
        const channel = manager.createChannel(def.type, {
          id: def.id,
          name: def.name,
          config: def.config || {},
          credentials: def.credentials || {},
        });
        // createChannel assigns a fresh id; keep the persisted one so inbound
        // webhook URLs stay valid across restarts.
        if (def.id && channel.id !== def.id) {
          manager.channels.delete(channel.id);
          channel.id = def.id;
          manager.channels.set(def.id, channel);
        }
        restored += 1;
      } catch { /* skip a definition the current build cannot build */ }
    }
    return restored;
  } catch {
    return 0;
  }
}
