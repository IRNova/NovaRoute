export default {
  id: "zed-hosted",
  display: {
    name: "Zed Hosted Models",
    icon: "code_blocks",
    color: "#101010",
    textIcon: "ZH",
    website: "https://zed.dev",
  },
  category: "oauth",
  authHint: "Sign in with your Zed account (native-app sign-in). Nova Route generates a one-time RSA keypair and opens zed.dev to authorize it — on a remote/headless install, copy the resulting 127.0.0.1 callback URL from your browser's address bar and paste it back here. Distinct from the 'Zed IDE' credential-import entry above: this proxies chat completions through Zed's own hosted model aggregator (cloud.zed.dev), fronting Anthropic/OpenAI/Google/xAI models under your Zed plan.",
  transport: {
    baseUrl: "https://cloud.zed.dev/completions",
    authType: "oauth",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
    forceStream: true,
    timeoutMs: 120000,
    modelsFetcher: {
      url: "https://cloud.zed.dev/models",
      type: "openai",
    },
  },
  models: [],
  passthroughModels: true,
  hasOAuth: true,
  oauth: {
    clientId: "zed-hosted",
    authorizeUrl: "https://zed.dev/auth",
    tokenUrl: "https://cloud.zed.dev/token",
    rsaKeyExchange: true,
  },
};
