/**
 * Virtual Keys API — /api/virtual-keys
 * 
 * GET    — List keys / get spend summary
 * POST   — Create key
 * PUT    — Update key
 * DELETE — Delete key
 */

const { getVirtualKeyManager } = require('@/lib/virtualKeys/virtualKeyManager');

// GET — List keys or get spend summary
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action') || 'list';
  const manager = getVirtualKeyManager();
  await manager.ensureLoaded();

  if (action === 'spend') {
    const keyId = searchParams.get('keyId');
    if (keyId) {
      return Response.json({ spend: manager.getSpendSummary(keyId) });
    }
    return Response.json({ spend: manager.getTotalSpend() });
  }

  if (action === 'stats') {
    return Response.json(manager.getTotalSpend());
  }

  const filter = {};
  if (searchParams.get('userId')) filter.userId = searchParams.get('userId');
  if (searchParams.get('tier')) filter.tier = searchParams.get('tier');

  return Response.json({ keys: manager.listKeys(filter) });
}

// POST — Create key
export async function POST(req) {
  try {
    const body = await req.json();
    const manager = getVirtualKeyManager();
    await manager.ensureLoaded();
    if (manager.listKeys().length >= (manager.maxKeys || 10000)) {
      return Response.json({ error: 'Maximum number of virtual keys reached' }, { status: 400 });
    }
    const result = manager.createKey(body);
    return Response.json({ success: true, ...result });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

// PUT — Update key
export async function PUT(req) {
  try {
    const body = await req.json();
    const { keyId, ...updates } = body;
    if (!keyId) return Response.json({ error: 'keyId required' }, { status: 400 });

    const manager = getVirtualKeyManager();
    await manager.ensureLoaded();
    const key = manager.updateKey(keyId, updates);
    return Response.json({ success: true, key });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

// DELETE — Delete key
export async function DELETE(req) {
  const { searchParams } = new URL(req.url);
  const keyId = searchParams.get('keyId');
  if (!keyId) return Response.json({ error: 'keyId required' }, { status: 400 });

  const manager = getVirtualKeyManager();
  await manager.ensureLoaded();
  const deleted = manager.deleteKey(keyId);
  return Response.json({ success: deleted, keyId });
}
