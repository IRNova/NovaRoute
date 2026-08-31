import https from "https";
import pkg from "../../../../package.json" with { type: "json" };

export const dynamic = "force-dynamic";

// GitHub release channel for the IRNova/NovaRoute project. Independent of the
// npm updater channel: this reads public GitHub releases/tags directly.
const REPO = process.env.GITHUB_UPDATE_REPO || "IRNova/NovaRoute";
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
  // A repo with no formal releases returns 404 → fall back to newest tag.
  let payload = release;
  if (!payload || !payload.tag_name) {
    const tags = await fetchJson(`https://api.github.com/repos/${REPO}/tags?per_page=10`);
    if (Array.isArray(tags) && tags.length > 0) {
      payload = { tag_name: tags[0].name, name: tags[0].name, body: "", html_url: `https://github.com/${REPO}/releases/tag/${tags[0].name}`, published_at: null };
    }
  }
  if (payload?.tag_name) {
    cache.value = payload;
    cache.fetchedAt = Date.now();
  }
  return payload;
}

export async function GET() {
  const currentVersion = pkg.version;
  const release = await getLatestReleaseCached();
  if (!release?.tag_name) {
    return Response.json({
      currentVersion,
      latestVersion: null,
      hasUpdate: false,
      repo: REPO,
      error: "Could not reach GitHub releases for this repository",
    });
  }
  const latestVersion = normalize(release.tag_name);
  const hasUpdate = compareVersions(latestVersion, currentVersion) > 0;
  return Response.json({
    currentVersion,
    latestVersion,
    tagName: release.tag_name,
    hasUpdate,
    releaseName: release.name || release.tag_name,
    releaseNotes: typeof release.body === "string" ? release.body.slice(0, 4000) : "",
    releaseUrl: release.html_url || `https://github.com/${REPO}/releases`,
    publishedAt: release.published_at || null,
    repo: REPO,
  });
}
