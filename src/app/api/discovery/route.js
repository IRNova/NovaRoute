import { NextResponse } from 'next/server';
import { DiscoverySystem } from '@/lib/discovery/index.js';

const discovery = new DiscoverySystem();

// GET — get discovery status
export async function GET(request) {
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get('action') ?? 'list';
    const providerId = url.searchParams.get('provider');

    switch (action) {
      case 'list': {
        const providers = discovery.getAll();
        return NextResponse.json({ providers, total: providers.length });
      }

      case 'status': {
        if (!providerId) return NextResponse.json({ error: 'provider required' }, { status: 400 });
        const status = discovery.getStatus(providerId);
        if (!status) return NextResponse.json({ error: 'Provider not found' }, { status: 404 });
        return NextResponse.json(status);
      }

      case 'models': {
        if (!providerId) return NextResponse.json({ error: 'provider required' }, { status: 400 });
        const models = discovery.getCachedModels(providerId);
        return NextResponse.json({ provider: providerId, models, total: models.length });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST — register providers, trigger discovery
export async function POST(request) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'register': {
        discovery.registerProvider(body.providerId, {
          baseUrl: body.baseUrl,
          apiKey: body.apiKey,
          apiType: body.apiType,
        });
        return NextResponse.json({ registered: true, providerId: body.providerId });
      }

      case 'discover': {
        const result = await discovery.discover(body.providerId);
        return NextResponse.json(result);
      }

      case 'discover-all': {
        const results = await discovery.discoverAll();
        return NextResponse.json({ results, total: results.length });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
