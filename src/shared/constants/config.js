import pkg from "../../../package.json" with { type: "json" };

// App configuration
export const APP_CONFIG = {
  name: "NovaRoute",
  description: "AI Infrastructure Management",
  version: pkg.version,
  versionLabel: "beta v 0.0.1",
};

// GitHub configuration
export const GITHUB_CONFIG = {
  // Served from the CHANGELOG.md bundled with this build. It used to fetch the
  // upstream author's repo at runtime, which meant the release notes shown in
  // the panel were whatever a third party had pushed, not what you are running.
  changelogUrl: "/api/changelog",
  donateUrl: "https://donate.novaproxy.online/",
};

// Updater configuration
//
// The self-updater is DISABLED by default. It installs and relaunches an npm
// package, and the package this fork inherited (`novaroute`) is published by the
// upstream author, not by IRNova. Leaving it on would let a third party ship
// code into every install. Turn it on only once an IRNova-owned package exists:
//
//   NOVAROUTE_UPDATE_CHANNEL=npm
//   NOVAROUTE_NPM_PACKAGE=<the package IRNova publishes>
//
// With no package name set the channel stays off even if it is enabled.
const NPM_PACKAGE_NAME = process.env.NOVAROUTE_NPM_PACKAGE || "";
const UPDATE_CHANNEL_ON =
  process.env.NOVAROUTE_UPDATE_CHANNEL === "npm" && NPM_PACKAGE_NAME !== "";

export const UPDATER_CONFIG = {
  enabled: UPDATE_CHANNEL_ON,
  npmPackageName: NPM_PACKAGE_NAME,
  installCmd: NPM_PACKAGE_NAME ? `npm i -g ${NPM_PACKAGE_NAME}` : "",
  installCmdLatest: NPM_PACKAGE_NAME
    ? `npm i -g ${NPM_PACKAGE_NAME}@latest --prefer-online`
    : "",
  shutdownCountdownSec: 3,
  exitDelayMs: 500,
  statusPort: 20129,
  statusPollIntervalMs: 1000,
  statusLogTailLines: 8,
  installRetries: 3,
  installRetryDelayMs: 5000,
  lingerAfterDoneMs: 30000,
  waitForExitMinMs: 5000,
  waitForExitMaxMs: 20000,
  waitForExitCheckMs: 500,
  appPort: 20128,
};

// Theme configuration
//
// Nova is dark-first: dark is the default and light is opt-in. Keep this in
// sync with the pre-paint script in src/app/layout.js, which reads the same
// storage key and has to assume the same default before React boots.
export const THEME_CONFIG = {
  storageKey: "theme",
  defaultTheme: "dark", // "light" | "dark" | "system"
  themes: ["dark", "light", "system"],
};

// Subscription
export const SUBSCRIPTION_CONFIG = {
  price: 1.0,
  currency: "USD",
  interval: "month",
  planName: "Pro Plan",
};

// API endpoints
export const API_ENDPOINTS = {
  users: "/api/users",
  providers: "/api/providers",
  payments: "/api/payments",
  auth: "/api/auth",
};

export const CONSOLE_LOG_CONFIG = {
  maxLines: 200,
  pollIntervalMs: 1000,
};

// Client-side store TTL: how long fetched data stays fresh before re-fetching
export const CLIENT_STORE_TTL_MS = 60000;

// Quota auto-ping: keep 5h windows warm by sending a tiny request right after reset.
export const QUOTA_AUTOPING_CONFIG = {
  tickIntervalMs: 60000,                // scheduler tick
  pingLeadMs: 5000,                     // fire once reset passes (within tolerance)
  refreshAheadMs: 300000,               // refetch usage when within 5min of reset
  failureCooldownMs: 900000,            // avoid failed ping spam while upstream/auth is unhealthy
  providers: {
    claude: {
      settingsKey: "claudeAutoPing",    // preserve existing settings contract
      quotaKey: "session (5h)",         // quota key returned by usage handler
      pingModel: "claude-haiku-4-5-20251001",
      pingText: "hi",
      pingMaxTokens: 1,
    },
    codex: {
      settingsKey: "codexAutoPing",
      quotaKey: "session",
      pingWhenResetAtSlides: true,
      resetAtDriftMs: 30000,
      minPingIntervalMs: 600000,
      skipWhenBlockingQuotaExhausted: true,
      // Free and Plus Codex accounts both expose gpt-5.5; avoid fallback probes that waste requests.
      pingModel: "gpt-5.5",
      pingText: "hi",
      pingInstructions: "Reply with OK.",
      pingReasoningEffort: "none",
    },
  },
};

// Re-export from providers.js for backward compatibility
export {
  FREE_PROVIDERS,
  OAUTH_PROVIDERS,
  APIKEY_PROVIDERS,
  WEB_COOKIE_PROVIDERS,
  AI_PROVIDERS,
  AUTH_METHODS,
} from "./providers.js";

// Re-export from models.js for backward compatibility
export {
  PROVIDER_MODELS,
  AI_MODELS,
} from "./models.js";
