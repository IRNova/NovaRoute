export default {
  id: "snowflake",
  alias: "snowflake",
  display: {
    name: "Snowflake Cortex",
    icon: "ac_unit",
    color: "#29B5E8",
    textIcon: "SF",
    website: "https://www.snowflake.com",
  },
  category: "apikey",
  transport: {
    baseUrl: "https://{account}.snowflakecomputing.com/api/v2",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
  },
  models: [
    {
      id: "llama3.1-70b",
      name: "llama3.1-70b",
    },
    {
      id: "llama3.3-70b",
      name: "llama3.3-70b",
    },
    {
      id: "deepseek-r1",
      name: "deepseek-r1",
    },
    {
      id: "claude-3-5-sonnet",
      name: "claude-3-5-sonnet",
    },
  ],
};
