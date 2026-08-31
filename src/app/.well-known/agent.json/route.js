/**
 * Agent Card Discovery — `/.well-known/agent.json`
 * 
 * Exposes NovaRoute's capabilities for A2A-compatible agents.
 */

export async function GET() {
  const baseUrl = process.env.NEXTAUTH_URL || process.env.NOVAROUTE_BASE_URL || 'http://localhost:20126';

  const agentCard = {
    name: 'NovaRoute',
    description: 'Intelligent AI gateway with auto-routing across 369+ providers, smart routing, and multi-agent orchestration',
    url: `${baseUrl}/a2a`,
    version: '1.0.0',
    capabilities: {
      streaming: true,
      pushNotifications: false,
    },
    skills: [
      {
        id: 'smart-routing',
        name: 'Smart Routing',
        description: 'Routes prompts through NovaRoute intelligent pipeline with 19 combo strategies',
        tags: ['routing', 'llm', 'multi-provider', 'cost-optimization'],
        examples: [
          'Write a hello world in Python',
          'Explain quantum computing using the cheapest provider',
        ],
      },
      {
        id: 'quota-management',
        name: 'Quota Management',
        description: 'Natural-language queries about provider quotas',
        tags: ['quota', 'analytics', 'cost'],
        examples: [
          'Which provider has the most quota remaining?',
          'Suggest a free combo for coding',
        ],
      },
      {
        id: 'provider-discovery',
        name: 'Provider Discovery',
        description: 'Discovers and lists available providers and their capabilities',
        tags: ['providers', 'discovery', 'capabilities'],
        examples: [
          'What providers are available?',
          'Show me all image generation providers',
        ],
      },
      {
        id: 'cost-analysis',
        name: 'Cost Analysis',
        description: 'Analyzes token usage and costs across providers',
        tags: ['cost', 'analytics', 'usage'],
        examples: [
          'How much have I spent this month?',
          'Which provider is cheapest for coding?',
        ],
      },
      {
        id: 'health-report',
        name: 'Health Report',
        description: 'Reports system health and status',
        tags: ['health', 'monitoring', 'status'],
        examples: [
          'Is the system healthy?',
          'What is the server uptime?',
        ],
      },
      {
        id: 'list-capabilities',
        name: 'List Capabilities',
        description: 'Lists all available capabilities and features',
        tags: ['capabilities', 'features', 'info'],
        examples: [
          'What can NovaRoute do?',
          'Show me all available features',
        ],
      },
    ],
    authentication: {
      schemes: ['bearer'],
      apiKeyHeader: 'Authorization',
    },
  };

  return Response.json(agentCard, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
