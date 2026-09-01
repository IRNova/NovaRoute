// Nova Bot — external integrations: Google Drive, Home Assistant, X search,
// and platform emoji-reactions. All credentials live in kv scope "novaInteg"
// so admins configure them once from the dashboard/API side.

import { makeKv } from "@/lib/db/helpers/kvStore.js";

const kv = makeKv("novaInteg");

async function cfg(key) {
  const c = (await kv.get(key, null)) || null;
  return c || null;
}

/* ── Google Drive (Drive API v3, OAuth access token) ───────────────── */

function driveHeaders(tok) {
  return { authorization: `Bearer ${tok}` };
}

export async function driveList({ query, max }) {
  const c = await cfg("gdrive");
  if (!c?.accessToken) throw new Error('no Google token — set novaInteg "gdrive" {"accessToken"}');
  const params = new URLSearchParams({
    pageSize: String(Math.min(parseInt(max, 10) || 10, 50)),
    fields: "files(id,name,mimeType,size,modifiedTime)",
    ...(query ? { q: String(query) } : {}),
  });
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
    headers: driveHeaders(c.accessToken),
    signal: AbortSignal.timeout(20_000),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error?.message || `Drive HTTP ${res.status}`);
  const files = json?.files || [];
  if (!files.length) return "No files.";
  return files.map((f) => `${f.id} · ${f.name} (${f.mimeType}${f.size ? `, ${f.size}B` : ""})`).join("\n");
}

export async function driveRead({ file_id }) {
  const c = await cfg("gdrive");
  if (!c?.accessToken) throw new Error("no Google token");
  // Export Google-Docs style files, download binaries/plain.
  const metaRes = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file_id)}?fields=name,mimeType`, {
    headers: driveHeaders(c.accessToken),
    signal: AbortSignal.timeout(15_000),
  });
  const meta = await metaRes.json().catch(() => null);
  if (!metaRes.ok) throw new Error(meta?.error?.message || `HTTP ${metaRes.status}`);

  const isGDocs = /^application\/vnd\.google-apps\./.test(meta.mimeType || "");
  const url = isGDocs
    ? `https://www.googleapis.com/drive/v3/files/${file_id}/export?mimeType=text/plain`
    : `https://www.googleapis.com/drive/v3/files/${file_id}?alt=media`;
  const res = await fetch(url, { headers: driveHeaders(c.accessToken), signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`download HTTP ${res.status}`);
  const text = await res.text();
  return `File: ${meta.name}\n---\n${text.length > 12_000 ? text.slice(0, 12_000) + `\n…[total ${text.length}]` : text}`;
}

export async function driveSearch({ query, max }) {
  const q = `name contains '${String(query || "").replace(/'/g, "")}'`;
  return driveList({ query: q, max });
}

/* ── Home Assistant (REST API, long-lived access token) ────────────── */

export async function haStates({ entity_id }) {
  const c = await cfg("homeassistant");
  if (!c?.url || !c?.token) throw new Error('no HA config — set novaInteg "homeassistant" {"url","token"}');
  const res = await fetch(`${String(c.url).replace(/\/$/, "")}/api/states${entity_id ? "/" + encodeURIComponent(entity_id) : ""}`, {
    headers: { authorization: `Bearer ${c.token}` },
    signal: AbortSignal.timeout(15_000),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.message || `HA HTTP ${res.status}`);
  if (entity_id) {
    const s = json;
    return `${s.entity_id}: ${s.state}${s.attributes?.friendly_name ? ` (${s.attributes.friendly_name})` : ""}`;
  }
  const list = Array.isArray(json) ? json.slice(0, 40) : [];
  return list.map((s) => `${s.entity_id}: ${s.state}`).join("\n") || "(no entities)";
}

export async function haCall({ domain, service, entity_id, data }) {
  const c = await cfg("homeassistant");
  if (!c?.url || !c?.token) throw new Error("no HA config");
  const body = { ...(data || {}) };
  if (entity_id) body.entity_id = entity_id;
  const res = await fetch(`${String(c.url).replace(/\/$/, "")}/api/services/${encodeURIComponent(domain)}/${encodeURIComponent(service)}`, {
    method: "POST",
    headers: { authorization: `Bearer ${c.token}`, "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`HA HTTP ${res.status}`);
  return `✅ Called ${domain}.${service}${entity_id ? ` → ${entity_id}` : ""}.`;
}

/* ── X (Twitter) search via xAI API ────────────────────────────────── */

export async function xSearch({ query, max_results }) {
  const c = await cfg("xai");
  if (!c?.apiKey) throw new Error('no xAI key — set novaInteg "xai" {"apiKey"}');
  const limit = Math.min(parseInt(max_results, 10) || 8, 20);
  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: { authorization: `Bearer ${c.apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: "grok-3",
      messages: [{ role: "user", content: `Search X for recent posts about: ${query}` }],
      search_parameters: { mode: "live", max_search_results: limit, return_citations: true },
    }),
    signal: AbortSignal.timeout(45_000),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error?.message || `xAI HTTP ${res.status}`);
  const answer = json?.choices?.[0]?.message?.content || "(empty)";
  const cites = (json?.choices?.[0]?.message?.citations || []).slice(0, 8);
  return answer.slice(0, 4000) + (cites.length ? `\n\nSources:\n${cites.join("\n")}` : "");
}

/* ── Emoji reactions (platform adapters) ───────────────────────────── */

/** Telegram: set a message reaction (bot must be allowed in that chat). */
export async function tgSetReaction(token, chatId, messageId, emoji = "👍") {
  await fetch(`https://api.telegram.org/bot${token}/setMessageReaction`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, message_id: messageId, reaction: [{ type: "emoji", emoji }], is_big: false }),
    signal: AbortSignal.timeout(10_000),
  }).catch(() => {});
}

/** Discord: react to a message (emoji must be URL-encoded unicode ok). */
export async function discordReact(token, channelId, messageId, emoji = "👍") {
  await fetch(`https://discord.com/api/v10/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}/@me`, {
    method: "PUT",
    headers: { authorization: `Bot ${token}` },
    signal: AbortSignal.timeout(10_000),
  }).catch(() => {});
}

/* ── GitHub (via stored PAT) ──────────────────────────────────────── */

import { getGitHubToken } from "@/lib/nova/github.js";
import { createPendingApproval, waitForDecision } from "./tools.js";

async function ghFetch(path, { method = "GET", body } = {}) {
  const token = await getGitHubToken();
  if (!token) throw new Error("GitHub not connected — connect in Apps page first.");
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "NovaRoute-Bot",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `GitHub API error ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

/**
 * Every write goes past a human first.
 *
 * The read-only tools were the whole GitHub and Cloudflare surface, so the bot
 * could describe an account it could not change: "create a repository" simply
 * had no tool behind it. Writes exist now, and they are gated exactly like the
 * terminal tool, because an agent with a PAT can delete a repository as easily
 * as it can create one.
 */
async function approveWrite(summary, agentName) {
  const item = await createPendingApproval({ command: summary, agentName: agentName || "integrations" });
  const ok = await waitForDecision(item.id);
  if (!ok) throw new Error(`DENIED: the admin did not approve "${summary}".`);
  return true;
}

/** List user's GitHub repositories. */
export async function ghListRepos({ type = "owner", sort = "updated", per_page = 30 } = {}) {
  const params = new URLSearchParams({ type, sort, per_page: String(Math.min(per_page, 100)) });
  const repos = await ghFetch(`/user/repos?${params}`);
  if (!repos?.length) return "No repositories found.";
  return repos.map((r) => `${r.name} (${r.private ? "🔒 Private" : "🌐 Public"})${r.language ? ` · ${r.language}` : ""} · ${r.html_url}`).join("\n");
}

/** Get a specific GitHub repo's details. */
export async function ghGetRepo({ owner, repo }) {
  const data = await ghFetch(`/repos/${owner}/${repo}`);
  return `Name: ${data.name}\nDescription: ${data.description || "(none)"}\nVisibility: ${data.private ? "Private" : "Public"}\nLanguage: ${data.language || "N/A"}\nStars: ${data.stargazers_count} · Forks: ${data.forks_count}\nURL: ${data.html_url}`;
}

/** List branches of a GitHub repo. */
export async function ghListBranches({ owner, repo }) {
  const branches = await ghFetch(`/repos/${owner}/${repo}/branches?per_page=30`);
  if (!branches?.length) return "No branches found.";
  return branches.map((b) => `${b.name}${b.protected ? " 🔒" : ""}`).join("\n");
}

/** List issues of a GitHub repo. */
export async function ghListIssues({ owner, repo, state = "open", per_page = 20 }) {
  const params = new URLSearchParams({ state, per_page: String(Math.min(per_page, 50)) });
  const issues = await ghFetch(`/repos/${owner}/${repo}/issues?${params}`);
  if (!issues?.length) return `No ${state} issues found.`;
  return issues.filter((i) => !i.pull_request).map((i) => `#${i.number} ${i.title} [${i.state}] ${i.user?.login || ""}`).join("\n");
}

/** List recent commits of a GitHub repo. */
export async function ghListCommits({ owner, repo, sha = "main", per_page = 10 }) {
  const params = new URLSearchParams({ sha, per_page: String(Math.min(per_page, 30)) });
  const commits = await ghFetch(`/repos/${owner}/${repo}/commits?${params}`);
  if (!commits?.length) return "No commits found.";
  return commits.map((c) => `${c.sha.slice(0, 7)} ${c.commit.message.split("\n")[0]} — ${c.commit.author?.name || ""}`).join("\n");
}

/* ── GitHub writes (approval-gated) ─────────────────────────────── */

/** Create a repository for the connected user. */
export async function ghCreateRepo({ name, description, private: isPrivate = true, auto_init = true }, meta = {}) {
  const clean = String(name || "").trim();
  if (!/^[A-Za-z0-9._-]{1,100}$/.test(clean)) {
    return "ERROR: repository name must be 1-100 chars of letters, digits, dot, dash or underscore.";
  }
  await approveWrite(`GitHub: create ${isPrivate ? "private" : "public"} repository "${clean}"`, meta.agentName);
  const data = await ghFetch("/user/repos", {
    method: "POST",
    body: { name: clean, description: description || undefined, private: !!isPrivate, auto_init: !!auto_init },
  });
  return `Created ${data.full_name} (${data.private ? "private" : "public"})\nClone: ${data.clone_url}\nURL: ${data.html_url}`;
}

/** Create an issue. */
export async function ghCreateIssue({ owner, repo, title, body, labels }, meta = {}) {
  if (!owner || !repo || !title) return "ERROR: owner, repo and title are required.";
  await approveWrite(`GitHub: open issue "${title}" on ${owner}/${repo}`, meta.agentName);
  const data = await ghFetch(`/repos/${owner}/${repo}/issues`, {
    method: "POST",
    body: { title, body: body || undefined, labels: Array.isArray(labels) ? labels : undefined },
  });
  return `Opened #${data.number}: ${data.title}\n${data.html_url}`;
}

/** Create a branch from another branch's head. */
export async function ghCreateBranch({ owner, repo, branch, from = "main" }, meta = {}) {
  if (!owner || !repo || !branch) return "ERROR: owner, repo and branch are required.";
  await approveWrite(`GitHub: create branch "${branch}" from "${from}" on ${owner}/${repo}`, meta.agentName);
  const base = await ghFetch(`/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(from)}`);
  const data = await ghFetch(`/repos/${owner}/${repo}/git/refs`, {
    method: "POST",
    body: { ref: `refs/heads/${branch}`, sha: base.object.sha },
  });
  return `Created branch ${branch} at ${data.object.sha.slice(0, 7)}`;
}

/** Create or update a single file, which is how a commit is made over the API. */
export async function ghPutFile({ owner, repo, path, content, message, branch }, meta = {}) {
  if (!owner || !repo || !path || typeof content !== "string") {
    return "ERROR: owner, repo, path and content are required.";
  }
  const msg = message || `Update ${path}`;
  await approveWrite(`GitHub: commit "${msg}" to ${owner}/${repo}:${branch || "default"} (${path})`, meta.agentName);
  // Updating an existing file needs its blob sha; a missing file is a create.
  let sha;
  try {
    const existing = await ghFetch(
      `/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}${branch ? `?ref=${encodeURIComponent(branch)}` : ""}`
    );
    sha = Array.isArray(existing) ? undefined : existing?.sha;
  } catch {
    sha = undefined;
  }
  const data = await ghFetch(`/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`, {
    method: "PUT",
    body: {
      message: msg,
      content: Buffer.from(content, "utf8").toString("base64"),
      ...(sha ? { sha } : {}),
      ...(branch ? { branch } : {}),
    },
  });
  return `${sha ? "Updated" : "Created"} ${path} — ${data.commit.sha.slice(0, 7)}\n${data.content?.html_url || ""}`;
}

/** Open a pull request. */
export async function ghCreatePr({ owner, repo, title, head, base = "main", body }, meta = {}) {
  if (!owner || !repo || !title || !head) return "ERROR: owner, repo, title and head are required.";
  await approveWrite(`GitHub: open PR "${title}" (${head} -> ${base}) on ${owner}/${repo}`, meta.agentName);
  const data = await ghFetch(`/repos/${owner}/${repo}/pulls`, {
    method: "POST",
    body: { title, head, base, body: body || undefined },
  });
  return `Opened PR #${data.number}: ${data.title}\n${data.html_url}`;
}

/* ── Cloudflare (via stored API token) ──────────────────────────── */

import { getCloudflareToken } from "@/lib/nova/cloudflare.js";

async function cfFetch(path, { method = "GET", body } = {}) {
  const token = await getCloudflareToken();
  if (!token) throw new Error("Cloudflare not connected — connect in Apps page first.");
  const res = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(20_000),
  });
  const data = await res.json().catch(() => ({}));
  if (!data.success) throw new Error(data.errors?.[0]?.message || `Cloudflare API error ${res.status}`);
  return data;
}

/**
 * Cloudflare account id, resolved once per process.
 *
 * Most account-scoped endpoints need it in the path. cfListWorkers asked for
 * /accounts/workers/scripts with no id at all, which cannot match a route.
 */
let cfAccountId = null;
async function cfAccount() {
  if (cfAccountId) return cfAccountId;
  const data = await cfFetch("/accounts?per_page=1");
  const id = data.result?.[0]?.id;
  if (!id) throw new Error("No Cloudflare account is visible to this API token.");
  cfAccountId = id;
  return id;
}

/** List Cloudflare zones (domains). */
export async function cfListZones({ per_page = 20 } = {}) {
  const data = await cfFetch(`/zones?per_page=${Math.min(per_page, 50)}`);
  if (!data.result?.length) return "No zones found.";
  return data.result.map((z) => `${z.name} (${z.status}) · ID: ${z.id}`).join("\n");
}

/** List DNS records for a zone. */
export async function cfListDns({ zone_id, type, name, per_page = 50 } = {}) {
  const params = new URLSearchParams({ per_page: String(Math.min(per_page, 100)) });
  if (type) params.set("type", type);
  if (name) params.set("name", name);
  const data = await cfFetch(`/zones/${zone_id}/dns_records?${params}`);
  if (!data.result?.length) return "No DNS records found.";
  return data.result.map((r) => `${r.type} ${r.name} → ${r.content}${r.proxied ? " (proxied)" : ""}`).join("\n");
}

/** List Cloudflare Workers. */
export async function cfListWorkers({ per_page = 25 } = {}) {
  const account = await cfAccount();
  const data = await cfFetch(`/accounts/${account}/workers/scripts?per_page=${Math.min(per_page, 50)}`);
  if (!data.result?.length) return "No workers found.";
  return data.result.map((w) => `${w.id} · modified: ${w.modified_on || "n/a"}`).join("\n");
}

/* ── Cloudflare writes (approval-gated) ─────────────────────────── */

const CF_DNS_TYPES = new Set(["A", "AAAA", "CNAME", "TXT", "MX", "NS", "SRV", "CAA"]);

/** Create a DNS record. */
export async function cfCreateDns({ zone_id, type, name, content, ttl = 1, proxied = false }, meta = {}) {
  if (!zone_id || !type || !name || !content) return "ERROR: zone_id, type, name and content are required.";
  const t = String(type).toUpperCase();
  if (!CF_DNS_TYPES.has(t)) return `ERROR: unsupported record type ${t}.`;
  await approveWrite(`Cloudflare: create ${t} record ${name} -> ${content}`, meta.agentName);
  const data = await cfFetch(`/zones/${zone_id}/dns_records`, {
    method: "POST",
    body: { type: t, name, content, ttl, proxied: !!proxied },
  });
  return `Created ${data.result.type} ${data.result.name} -> ${data.result.content} (id ${data.result.id})`;
}

/** Update an existing DNS record. */
export async function cfUpdateDns({ zone_id, record_id, type, name, content, ttl = 1, proxied }, meta = {}) {
  if (!zone_id || !record_id) return "ERROR: zone_id and record_id are required.";
  await approveWrite(`Cloudflare: update DNS record ${record_id} in zone ${zone_id}`, meta.agentName);
  const current = await cfFetch(`/zones/${zone_id}/dns_records/${record_id}`);
  const body = {
    type: (type || current.result.type).toUpperCase(),
    name: name || current.result.name,
    content: content ?? current.result.content,
    ttl: ttl ?? current.result.ttl,
    proxied: proxied ?? current.result.proxied,
  };
  const data = await cfFetch(`/zones/${zone_id}/dns_records/${record_id}`, { method: "PUT", body });
  return `Updated ${data.result.type} ${data.result.name} -> ${data.result.content}`;
}

/**
 * Delete a DNS record.
 *
 * Deliberately the only destructive integration tool. Removing a record can
 * take a site off the internet, so the approval line names the exact record
 * rather than just its id.
 */
export async function cfDeleteDns({ zone_id, record_id }, meta = {}) {
  if (!zone_id || !record_id) return "ERROR: zone_id and record_id are required.";
  const current = await cfFetch(`/zones/${zone_id}/dns_records/${record_id}`);
  const r = current.result;
  await approveWrite(`Cloudflare: DELETE ${r.type} ${r.name} -> ${r.content}`, meta.agentName);
  await cfFetch(`/zones/${zone_id}/dns_records/${record_id}`, { method: "DELETE" });
  return `Deleted ${r.type} ${r.name}`;
}

/** Purge a zone's cache, either everything or specific URLs. */
export async function cfPurgeCache({ zone_id, files }, meta = {}) {
  if (!zone_id) return "ERROR: zone_id is required.";
  const everything = !Array.isArray(files) || files.length === 0;
  await approveWrite(
    everything ? `Cloudflare: purge the ENTIRE cache of zone ${zone_id}` : `Cloudflare: purge ${files.length} URL(s) from zone ${zone_id}`,
    meta.agentName
  );
  await cfFetch(`/zones/${zone_id}/purge_cache`, {
    method: "POST",
    body: everything ? { purge_everything: true } : { files },
  });
  return everything ? "Purged the whole zone cache." : `Purged ${files.length} URL(s).`;
}
