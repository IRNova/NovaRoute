import { getProviderConnections } from "@/lib/db/repos/connectionsRepo.js";
import { kv } from "@/lib/db/helpers/kvStore.js";

const GITHUB_API = "https://api.github.com";

const githubKv = kv("novaGitHub");

// ── OAuth config ──────────────────────────────────────────────────────────────
// GitHub OAuth App — redirect-based flow for full repo access
// Config is read from DB first, then falls back to environment variables.
const GITHUB_SCOPES = "repo read:user user:email";
const OAUTH_CONFIG_KEY = "oauthConfig";

let _cachedOAuthConfig = null;
let _cacheTs = 0;
const CACHE_TTL = 30_000;

async function loadOAuthConfig() {
  const now = Date.now();
  if (_cachedOAuthConfig && now - _cacheTs < CACHE_TTL) return _cachedOAuthConfig;
  try {
    const stored = await githubKv.get(OAUTH_CONFIG_KEY);
    _cachedOAuthConfig = stored && typeof stored === "object" ? stored : null;
    _cacheTs = now;
  } catch { _cachedOAuthConfig = null; }
  return _cachedOAuthConfig;
}

export async function getGitHubConfig() {
  const db = await loadOAuthConfig();
  return {
    clientId: db?.clientId || process.env.GITHUB_CLIENT_ID || "",
    clientSecret: db?.clientSecret || process.env.GITHUB_CLIENT_SECRET || "",
    scopes: db?.scopes || GITHUB_SCOPES,
    hasClientSecret: Boolean(db?.clientSecret || process.env.GITHUB_CLIENT_SECRET),
  };
}

export async function saveGitHubOAuthConfig({ clientId, clientSecret }) {
  const patch = {};
  if (clientId !== undefined) patch.clientId = clientId;
  if (clientSecret !== undefined) patch.clientSecret = clientSecret;
  await githubKv.set(OAUTH_CONFIG_KEY, patch);
  _cachedOAuthConfig = null;
  _cacheTs = 0;
  return patch;
}

export async function getGitHubConnection() {
  const conns = await getProviderConnections({ provider: "github-app", isActive: true });
  return conns[0] || null;
}

export async function getGitHubToken() {
  const conn = await getGitHubConnection();
  if (!conn?.accessToken) return null;
  return conn.accessToken;
}

export async function getGitHubUser() {
  const cfg = await githubKv.get("user");
  return cfg || null;
}

async function ghFetch(path, options = {}) {
  const token = await getGitHubToken();
  if (!token) throw new Error("GitHub not connected — connect your account first");

  const url = path.startsWith("http") ? path : `${GITHUB_API}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      Authorization: `Bearer ${token}`,
      "User-Agent": "NovaRoute-Bot",
      ...options.headers,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `GitHub API error ${res.status}`);
  }

  if (res.status === 204) return null;
  return res.json();
}

// ── User ──────────────────────────────────────────────────────────────────────

export async function fetchAndStoreUser() {
  const user = await ghFetch("/user");
  await githubKv.set("user", {
    login: user.login,
    id: user.id,
    name: user.name,
    email: user.email,
    avatar_url: user.avatar_url,
    html_url: user.html_url,
    public_repos: user.public_repos,
    followers: user.followers,
    following: user.following,
  });
  return user;
}

// ── Repos ─────────────────────────────────────────────────────────────────────

export async function listRepos({ type = "all", sort = "updated", direction = "desc", per_page = 30, page = 1 } = {}) {
  const params = new URLSearchParams({ type, sort, direction, per_page: String(per_page), page: String(page) });
  return ghFetch(`/user/repos?${params}`);
}

export async function getRepo(owner, repo) {
  return ghFetch(`/repos/${owner}/${repo}`);
}

export async function createRepo({ name, description = "", private: isPrivate = false, auto_init = true, homepage = "" }) {
  const body = { name, description, private: isPrivate, auto_init };
  if (homepage) body.homepage = homepage;
  return ghFetch("/user/repos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function deleteRepo(owner, repo) {
  await ghFetch(`/repos/${owner}/${repo}`, { method: "DELETE" });
}

export async function forkRepo(owner, repo) {
  return ghFetch(`/repos/${owner}/${repo}/forks`, { method: "POST" });
}

// ── Contents (files) ──────────────────────────────────────────────────────────

export async function readFile(owner, repo, path, ref = "main") {
  const params = ref ? `?ref=${ref}` : "";
  return ghFetch(`/repos/${owner}/${repo}/contents/${path}${params}`);
}

export async function pushFile(owner, repo, path, content, message, { branch = "main", committerName = "Nova Bot", committerEmail = "bot@novaroute.app" } = {}) {
  const body = {
    message,
    content: typeof content === "string" ? btoa(unescape(encodeURIComponent(content))) : content.toString("base64"),
    branch,
    committer: { name: committerName, email: committerEmail },
  };

  try {
    const existing = await readFile(owner, repo, path, branch);
    if (existing?.sha) body.sha = existing.sha;
  } catch { /* new file */ }

  return ghFetch(`/repos/${owner}/${repo}/contents/${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function deleteFile(owner, repo, path, message, { branch = "main", committerName = "Nova Bot", committerEmail = "bot@novaroute.app" } = {}) {
  const existing = await readFile(owner, repo, path, branch);
  if (!existing?.sha) throw new Error("File not found");

  return ghFetch(`/repos/${owner}/${repo}/contents/${path}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      sha: existing.sha,
      branch,
      committer: { name: committerName, email: committerEmail },
    }),
  });
}

export async function listContents(owner, repo, path = "", ref = "main") {
  const params = ref ? `?ref=${ref}` : "";
  return ghFetch(`/repos/${owner}/${repo}/contents/${path}${params}`);
}

// ── Commits ───────────────────────────────────────────────────────────────────

export async function listCommits(owner, repo, { sha = "main", per_page = 10, page = 1 } = {}) {
  const params = new URLSearchParams({ sha, per_page: String(per_page), page: String(page) });
  return ghFetch(`/repos/${owner}/${repo}/commits?${params}`);
}

export async function getCommit(owner, repo, sha) {
  return ghFetch(`/repos/${owner}/${repo}/commits/${sha}`);
}

// ── Branches ──────────────────────────────────────────────────────────────────

export async function listBranches(owner, repo, per_page = 30) {
  return ghFetch(`/repos/${owner}/${repo}/branches?per_page=${per_page}`);
}

export async function createBranch(owner, repo, branchName, fromSha) {
  return ghFetch(`/repos/${owner}/${repo}/git/refs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha: fromSha }),
  });
}

// ── Issues ────────────────────────────────────────────────────────────────────

export async function listIssues(owner, repo, { state = "open", per_page = 10, page = 1 } = {}) {
  const params = new URLSearchParams({ state, per_page: String(per_page), page: String(page) });
  return ghFetch(`/repos/${owner}/${repo}/issues?${params}`);
}

export async function createIssue(owner, repo, { title, body = "", labels = [], assignees = [] }) {
  return ghFetch(`/repos/${owner}/${repo}/issues`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, body, labels, assignees }),
  });
}

export async function closeIssue(owner, repo, issueNumber) {
  return ghFetch(`/repos/${owner}/${repo}/issues/${issueNumber}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ state: "closed" }),
  });
}

// ── Pull Requests ─────────────────────────────────────────────────────────────

export async function listPullRequests(owner, repo, { state = "open", per_page = 10, page = 1 } = {}) {
  const params = new URLSearchParams({ state, per_page: String(per_page), page: String(page) });
  return ghFetch(`/repos/${owner}/${repo}/pulls?${params}`);
}

export async function createPullRequest(owner, repo, { title, body = "", head, base = "main" }) {
  return ghFetch(`/repos/${owner}/${repo}/pulls`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, body, head, base }),
  });
}

// ── Search ────────────────────────────────────────────────────────────────────

export async function searchRepos(query, { sort = "stars", per_page = 10 } = {}) {
  const params = new URLSearchParams({ q: query, sort, per_page: String(per_page) });
  return ghFetch(`/search/repositories?${params}`);
}

// ── Rate Limit ────────────────────────────────────────────────────────────────

export async function getRateLimit() {
  return ghFetch("/rate_limit");
}

// ── Connection Management ─────────────────────────────────────────────────────

export async function disconnectGitHub() {
  await githubKv.remove("user");
}

export async function isConnected() {
  const token = await getGitHubToken();
  return Boolean(token);
}
