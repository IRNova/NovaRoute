// Base URL resolution for local runtimes.
// Reads an optional per-runtime override from credentials.providerSpecificData,
// else falls back to the runtime's default local port.
const LOCAL_DEFAULTS = {
  "ollama": "http://localhost:11434",
  "lm-studio": "http://localhost:1234",
  "llamacpp": "http://localhost:8080",
};

const PROVIDER_TO_RUNTIME = {
  "ollama-local": "ollama",
  "lm-studio-local": "lm-studio",
  "llamacpp-local": "llamacpp",
};

/** Resolve the base URL for a local runtime. Fail-open to default on bad input. */
export function resolveLocalHost(credentials, runtime) {
  const rt = PROVIDER_TO_RUNTIME[runtime] || runtime;
  const raw = credentials?.providerSpecificData?.baseUrl || credentials?.baseUrl;
  const url = raw || LOCAL_DEFAULTS[rt] || "http://localhost:11434";
  return String(url)
    .replace(/\/+$/, "")
    .replace(/\/v1\/chat\/completions$/, "")
    .replace(/\/v1$/, "");
}

/** All known local runtime ids. */
export const LOCAL_RUNTIMES = Object.keys(LOCAL_DEFAULTS);

/** Provider id used in routing candidates for a runtime. */
export function providerIdForRuntime(runtime) {
  if (runtime === "ollama") return "ollama-local";
  if (runtime === "lm-studio") return "lm-studio-local";
  if (runtime === "llamacpp") return "llamacpp-local";
  return `${runtime}-local`;
}
