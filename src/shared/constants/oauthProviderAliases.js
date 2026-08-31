// Registry card ids → canonical OAuth flow ids. Some connect cards ship under a
// distinct id while the flow implementation (and the saved connection's provider)
// lives under the backend provider name. Client-safe (no node imports).
export const OAUTH_PROVIDER_ALIASES = {
  "kimi-coding": "kimi",
  "agy": "antigravity",
  "xai-oauth": "xai",
  "gitlab-duo": "gitlab",
  "ghe-copilot": "github",
  "zed-hosted": "zed",
};

export function resolveOAuthProviderId(name) {
  return OAUTH_PROVIDER_ALIASES[name] || name;
}
