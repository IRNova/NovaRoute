import { NextResponse } from 'next/server';
import { RateLimiter, IPBlocker, InputSanitizer, APIKeyValidator } from '@/lib/security/index.js';
import { makeKv } from '@/lib/db/helpers/kvStore.js';
import { banIpManually, unbanIp, listActiveBans } from '@/lib/security/gatewayAutoBan.js';

const rateLimiter = new RateLimiter({ maxRequests: 100 });
const ipBlocker = new IPBlocker();
const inputSanitizer = new InputSanitizer();
const apiKeyValidator = new APIKeyValidator();

// Blocked-IP persistence: survives restarts. Restored on first use, saved
// after every block/unblock mutation.
const securityKv = makeKv('security');
let blockedRestored = false;

async function restoreBlockedIPs() {
  if (blockedRestored) return;
  blockedRestored = true;
  try {
    const snapshot = await securityKv.get('blockedIPs', null);
    if (!snapshot || typeof snapshot !== 'object') return;
    for (const ip of Array.isArray(snapshot.permanent) ? snapshot.permanent : []) {
      if (typeof ip === 'string' && !ipBlocker.blocked.has(ip)) ipBlocker.blockIP(ip);
    }
    for (const t of Array.isArray(snapshot.temporary) ? snapshot.temporary : []) {
      if (!t || typeof t.ip !== 'string') continue;
      const expiry = Date.parse(t.expiresAt);
      if (Number.isFinite(expiry) && expiry > Date.now()) {
        ipBlocker.blockIP(t.ip, expiry - Date.now());
      }
    }
  } catch {}
}

async function persistBlockedIPs() {
  try {
    await securityKv.set('blockedIPs', ipBlocker.getBlocked());
  } catch {}
}

// GET — get security status
export async function GET(request) {
  try {
    await restoreBlockedIPs();
    const url = new URL(request.url);
    const action = url.searchParams.get('action') ?? 'status';

    switch (action) {
      case 'status': {
        // Merge enforced auto-bans into the display so the UI shows one list.
        let blocked = ipBlocker.getBlocked();
        try {
          const bans = await listActiveBans();
          const permanent = new Set(Array.isArray(blocked?.permanent) ? blocked.permanent : []);
          for (const b of bans) permanent.add(b.ip);
          blocked = { ...blocked, permanent: [...permanent] };
        } catch {}
        return NextResponse.json({
          rateLimiter: { windowMs: rateLimiter.windowMs, maxRequests: rateLimiter.maxRequests },
          blockedIPs: blocked,
          apiKeys: apiKeyValidator.listKeys(),
        });
      }

      case 'rate-limit': {
        const key = url.searchParams.get('key') ?? 'default';
        const usage = rateLimiter.getUsage(key);
        return NextResponse.json(usage);
      }

      case 'blocked-ips': {
        const blocked = ipBlocker.getBlocked();
        return NextResponse.json(blocked);
      }

      case 'api-keys': {
        const keys = apiKeyValidator.listKeys();
        return NextResponse.json({ keys, total: keys.length });
      }

      case 'check-ip': {
        const ip = url.searchParams.get('ip');
        const result = ipBlocker.isBlocked(ip);
        return NextResponse.json({ ip, ...result });
      }

      case 'check-rate': {
        const key = url.searchParams.get('key') ?? 'default';
        const limit = parseInt(url.searchParams.get('limit') ?? '100');
        const result = rateLimiter.check(key, limit);
        return NextResponse.json(result);
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST — manage security
export async function POST(request) {
  try {
    await restoreBlockedIPs();
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'block-ip': {
        ipBlocker.blockIP(body.ip, body.durationMs);
        // Manual blocks are enforced gateway-wide via the auto-ban store too.
        if (!body.durationMs) await banIpManually(body.ip);
        await persistBlockedIPs();
        return NextResponse.json({ blocked: true, ip: body.ip });
      }

      case 'unblock-ip': {
        ipBlocker.unblockIP(body.ip);
        await unbanIp(body.ip);
        await persistBlockedIPs();
        return NextResponse.json({ unblocked: true, ip: body.ip });
      }

      case 'reset-rate': {
        rateLimiter.reset(body.key);
        return NextResponse.json({ reset: true, key: body.key });
      }

      case 'register-key': {
        const keyId = apiKeyValidator.register(body.key, {
          userId: body.userId,
          permissions: body.permissions,
        });
        return NextResponse.json({ registered: true, keyId });
      }

      case 'validate-key': {
        const result = apiKeyValidator.validate(body.key);
        return NextResponse.json(result);
      }

      case 'revoke-key': {
        apiKeyValidator.revoke(body.key);
        return NextResponse.json({ revoked: true });
      }

      case 'sanitize': {
        const result = inputSanitizer.sanitizeChatRequest(body.body);
        return NextResponse.json(result);
      }

      case 'cleanup': {
        rateLimiter.cleanup();
        return NextResponse.json({ cleaned: true });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
