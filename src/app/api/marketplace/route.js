/**
 * Plugin Marketplace API — /api/marketplace
 * 
 * GET    — Search/list plugins
 * POST   — Install/register plugin
 * DELETE — Uninstall plugin
 */

const { getPluginRegistry } = require('@/lib/plugins/marketplace');

// GET — Search plugins
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q') || '';
  const category = searchParams.get('category') || undefined;
  const sort = searchParams.get('sort') || 'downloads';
  const action = searchParams.get('action') || 'search';

  const registry = getPluginRegistry();

  if (action === 'installed') {
    return Response.json({ plugins: registry.getInstalled() });
  }

  if (action === 'stats') {
    return Response.json(registry.stats());
  }

  if (action === 'detail') {
    const id = searchParams.get('id');
    const plugin = registry.get(id);
    if (!plugin) return Response.json({ error: 'Plugin not found' }, { status: 404 });
    return Response.json({ plugin });
  }

  const plugins = registry.search(query, { category, sort });
  return Response.json({ plugins, total: plugins.length });
}

// POST — Install or register plugin
export async function POST(req) {
  try {
    const body = await req.json();
    const { action, pluginId, manifest, config } = body;
    const registry = getPluginRegistry();

    if (action === 'install') {
      const installed = registry.install(pluginId, config);
      return Response.json({ success: true, plugin: installed });
    }

    if (action === 'register') {
      const plugin = registry.register(manifest);
      return Response.json({ success: true, plugin });
    }

    // Install directly from a GitHub repository. The repo must contain a
    // manifest at its root: novaroute-plugin.json (preferred), plugin.json,
    // or package.json. Hosts are hard-allowlisted so this can never become
    // an SSRF primitive.
    if (action === 'install-github') {
      const rawUrl = String(body.url || '').trim();
      const m = rawUrl.match(/^https:\/\/(?:www\.)?github\.com\/([\w.-]+)\/([\w.-]+)(?:\/tree\/([\w./-]+))?\/?$/i)
        || rawUrl.match(/^https:\/\/raw\.githubusercontent\.com\/([\w.-]+)\/([\w.-]+)\/([^/]+)\/(?:novaroute-plugin\.json|plugin\.json|package\.json)$/i);
      if (!m) {
        return Response.json({ error: 'Provide a github.com repo URL (https://github.com/user/repo)' }, { status: 400 });
      }
      const [, owner, repo, branchArg] = m;
      const branch = branchArg || 'HEAD';
      const bases = [
        `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/novaroute-plugin.json`,
        `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/plugin.json`,
        `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/package.json`,
      ];
      let manifest = null;
      let lastError = null;
      for (const url of bases) {
        try {
          const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
          if (!res.ok) { lastError = `HTTP ${res.status} for ${url.split('/').pop()}`; continue; }
          manifest = await res.json();
          break;
        } catch (e) { lastError = e.message; }
      }
      if (!manifest || typeof manifest !== 'object') {
        return Response.json({ error: `No plugin manifest found in repo (${lastError || 'not a NovaRoute plugin'})` }, { status: 400 });
      }
      const plugin = registry.register({
        id: manifest.id || `${owner}-${repo}`.toLowerCase(),
        name: manifest.name || repo,
        description: manifest.description || '',
        version: manifest.version || '1.0.0',
        author: manifest.author || owner,
        homepage: manifest.homepage || rawUrl,
        repository: `https://github.com/${owner}/${repo}`,
        ...manifest,
      });
      const installed = registry.install(plugin.id, config);
      return Response.json({ success: true, plugin: installed });
    }

    if (action === 'toggle') {
      const toggled = registry.toggle(pluginId, body.enabled);
      return Response.json({ success: true, plugin: toggled });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

// DELETE — Uninstall plugin
export async function DELETE(req) {
  const { searchParams } = new URL(req.url);
  const pluginId = searchParams.get('pluginId');

  if (!pluginId) {
    return Response.json({ error: 'pluginId required' }, { status: 400 });
  }

  const registry = getPluginRegistry();
  try {
    registry.uninstall(pluginId);
    return Response.json({ success: true, pluginId });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
