import https from "https";
import { execSync } from "node:child_process";
import pkg from "../../../../package.json" with { type: "json" };

export const dynamic = "force-dynamic";

// GitHub release channel for the IRNova/NovaRoute project. Independent of the
// npm updater channel: this reads public GitHub releases/tags directly.
const REPO = process.env.GITHUB_UPDATE_REPO || "IRNova/NovaRoute";
const BRANCH = process.env.NOVAROUTE_UPDATE_BRANCH || "main";
const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = (global.__ghUpdateCache ??= { value: null, fetchedAt: 0 });

function fetchJson(url, headers = {}) {
  return new Promise((resolve) => {
    const req = https.get(
      url,
      {
        timeout: 6000,
        headers: {
          "User-Agent": "NovaRoute-Updater",
          Accept: "application/vnd.github+json",
          ...headers,
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            if (res.statusCode !== 200) return resolve(null);
            resolve(JSON.parse(data));
          } catch {
            resolve(null);
          }
        });
      }
    );
    req.on("error", () => resolve(null));
    req.on("timeout", () => {
      req.destroy();
      resolve(null);
    });
  });
}

function normalize(v) {
  return String(v || "").replace(/^v/i, "").trim();
}

function compareVersions(a, b) {
  const pa = normalize(a).split(".").map((n) => parseInt(n, 10) || 0);
  const pb = normalize(b).split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return 1;
    if ((pa[i] || 0) < (pb[i] || 0)) return -1;
  }
  return 0;
}

async function getLatestReleaseCached() {
  if (cache.value && Date.now() - cache.fetchedAt < CACHE_TTL_MS) return cache.value;
  const release = await fetchJson(`https://api.github.com/repos/${REPO}/releases/latest`);
  // A repo with no formal releases returns 404 -> fall back to newest tag.
  let payload = release;
  if (!payload || !payload.tag_name) {
    const tags = await fetchJson(`https://api.github.com/repos/${REPO}/tags?per_page=10`);
    if (Array.isArray(tags) && tags.length > 0) {
      payload = { tag_name: tags[0].name, name: tags[0].name, body: "", html_url: `https://github.com/${REPO}/releases/tag/${tags[0].name}`, published_at: null };
    }
  }
  // Neither releases nor tags: this repository ships from a branch, so the
  // branch head is the update target. Without this the panel reported
  // "Could not reach GitHub releases" forever and offered no way to update.
  if (!payload || !payload.tag_name) {
    const commit = await fetchJson(`https://api.github.com/repos/${REPO}/commits/${BRANCH}`);
    if (commit?.sha) {
      payload = {
        tag_name: null,
        channel: "branch",
        sha: String(commit.sha).slice(0, 7),
        name: `${BRANCH} @ ${String(commit.sha).slice(0, 7)}`,
        body: commit.commit?.message || "",
        html_url: `https://github.com/${REPO}/commits/${BRANCH}`,
        published_at: commit.commit?.committer?.date || null,
      };
    }
  }
  if (payload?.tag_name || payload?.sha) {
    cache.value = payload;
    cache.fetchedAt = Date.now();
  }
  return payload;
}

function localSha() {
  try {
    return execSync("git rev-parse HEAD", {
      cwd: process.cwd(), encoding: "utf8", timeout: 5000, stdio: ["ignore", "pipe", "ignore"],
    }).trim().slice(0, 7);
  } catch {
    return "";
  }
}

export async function GET() {
  const currentVersion = pkg.version;
  const release = await getLatestReleaseCached();

  if (!release) {
    return Response.json({
      currentVersion,
      latestVersion: null,
      hasUpdate: false,
      repo: REPO,
      error: "Could not reach GitHub for this repository",
    });
  }

  // Branch channel: compare commits, not semver.
  if (release.channel === "branch") {
    const current = localSha();
    const hasUpdate = Boolean(current && release.sha && current !== release.sha);
    return Response.json({
      currentVersion,
      currentSha: current,
      latestVersion: release.sha,
      channel: "branch",
      branch: BRANCH,
      tagName: null,
      hasUpdate,
      releaseName: release.name,
      releaseNotes: typeof release.body === "string" ? release.body.slice(0, 4000) : "",
      releaseUrl: release.html_url,
      publishedAt: release.published_at,
      repo: REPO,
    });
  }

  const latestVersion = normalize(release.tag_name);
  const hasUpdate = compareVersions(latestVersion, currentVersion) > 0;
  return Response.json({
    currentVersion,
    latestVersion,
    tagName: release.tag_name,
    channel: "release",
    hasUpdate,
    releaseName: release.name || release.tag_name,
    releaseNotes: typeof release.body === "string" ? release.body.slice(0, 4000) : "",
    releaseUrl: release.html_url || `https://github.com/${REPO}/releases`,
    publishedAt: release.published_at || null,
    repo: REPO,
  });
}
