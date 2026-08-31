/**
 * Navigation E2E Tests — Tests all sidebar navigation links load correctly.
 */

const { test, expect } = require('@playwright/test');

const PAGES = [
  { path: '/dashboard', name: 'Dashboard Home' },
  { path: '/dashboard/providers', name: 'Providers' },
  { path: '/dashboard/skills', name: 'Skills' },
  { path: '/dashboard/settings', name: 'Settings' },
  { path: '/dashboard/usage', name: 'Usage' },
  { path: '/dashboard/api-keys', name: 'API Keys' },
  { path: '/dashboard/tokens', name: 'Tokens' },
  { path: '/dashboard/sessions', name: 'Sessions' },
  { path: '/dashboard/logs', name: 'Logs' },
  { path: '/dashboard/health', name: 'Health' },
  { path: '/dashboard/models', name: 'Models' },
  { path: '/dashboard/costs', name: 'Costs' },
  { path: '/dashboard/plugins', name: 'Plugins' },
  { path: '/dashboard/memory', name: 'Memory' },
  { path: '/dashboard/voice', name: 'Voice' },
  { path: '/dashboard/channels', name: 'Channels' },
  { path: '/dashboard/gamification', name: 'Gamification' },
  { path: '/dashboard/leaderboard', name: 'Leaderboard' },
  { path: '/dashboard/resilience', name: 'Resilience' },
  { path: '/dashboard/compliance', name: 'Compliance' },
  { path: '/dashboard/monitoring', name: 'Monitoring' },
  { path: '/dashboard/discovery', name: 'Discovery' },
  { path: '/dashboard/combos', name: 'Combos' },
  { path: '/dashboard/mcp', name: 'MCP' },
  { path: '/dashboard/webhooks', name: 'Webhooks' },
  { path: '/dashboard/search', name: 'Search Tools' },
  { path: '/dashboard/proxy-pools', name: 'Proxy Pools' },
  { path: '/dashboard/playground', name: 'Playground' },
  { path: '/dashboard/activity', name: 'Activity' },
  { path: '/dashboard/onboarding', name: 'Onboarding' },
];

test.describe('Navigation — All Dashboard Pages', () => {
  for (const page of PAGES) {
    test(`${page.name} page loads without error`, async ({ page: pw }) => {
      await pw.goto(page.path);
      // Should not show error page
      const body = await pw.textContent('body');
      expect(body).not.toContain('Application error');
      expect(body).not.toContain('Internal Server Error');
      expect(body).not.toContain('500');
    });
  }
});
