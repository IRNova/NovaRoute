export default {
  id: "gitlab-duo",
  alias: "gld",
  display: {
    name: "GitLab Duo",
    icon: "hub",
    color: "#FC6D26",
    textIcon: "GL",
    website: "https://docs.gitlab.com/user/duo_agent_platform/code_suggestions/",
  },
  category: "oauth",
  authHint: "GitLab Duo OAuth is not configured. Register an OAuth application at https://gitlab.com/-/profile/applications with redirect URI http://localhost:20128/callback and scopes \"ai_features read_user\", then set GITLAB_DUO_OAUTH_CLIENT_ID (and optionally GITLAB_DUO_OAUTH_CLIENT_SECRET) and restart.",
  transport: {
    baseUrl: "https://gitlab.com/api/v4/code_suggestions/completions",
    authType: "oauth",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
  },
  oauth: {
    tokenUrl: "https://gitlab.com/oauth/token",
    clientId: "",
    clientSecret: "",
    authorizeUrl: "https://gitlab.com/oauth/authorize",
  },
  models: [
    {
      id: "claude-sonnet-4-6",
      name: "Claude Sonnet 4.6 (GitLab Duo)",
      contextLength: 128000,
    },
    {
      id: "claude-haiku-4-5",
      name: "Claude Haiku 4.5 (GitLab Duo)",
      contextLength: 128000,
    },
  ],
};
