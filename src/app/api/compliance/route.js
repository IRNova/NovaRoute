import { NextResponse } from 'next/server';
import { PolicyEngine, UsageTracker } from '@/lib/compliance/index.js';
import { auditTrail, restoreAuditTrail } from '@/lib/compliance/auditTrail.js';

// The audit trail is shared with live gateway hooks (auto-ban, guardrails) via
// src/lib/compliance/auditTrail.js — one merged persisted store.
const auditLogger = auditTrail;
const policyEngine = new PolicyEngine();
const usageTracker = new UsageTracker();

let auditRestored = false;
async function restoreAuditEntries() {
  if (auditRestored) return;
  auditRestored = true;
  await restoreAuditTrail();
}

// GET — query audit logs, policies, usage
export async function GET(request) {
  try {
    await restoreAuditEntries();
    const url = new URL(request.url);
    const action = url.searchParams.get('action') ?? 'audit';

    switch (action) {
      case 'audit': {
        const filter = {
          userId: url.searchParams.get('userId'),
          action: url.searchParams.get('auditAction'),
          provider: url.searchParams.get('provider'),
          severity: url.searchParams.get('severity'),
          since: url.searchParams.get('since'),
          limit: parseInt(url.searchParams.get('limit') ?? '100'),
        };
        const entries = auditLogger.query(filter);
        return NextResponse.json({ entries, total: entries.length });
      }

      case 'stats': {
        const period = url.searchParams.get('period') ?? '24h';
        const stats = auditLogger.getStats(period);
        return NextResponse.json(stats);
      }

      case 'policies': {
        const policies = policyEngine.listPolicies();
        return NextResponse.json({ policies, total: policies.length });
      }

      case 'usage': {
        const userId = url.searchParams.get('userId') ?? 'default';
        const usage = usageTracker.getUsage(userId);
        return NextResponse.json(usage);
      }

      case 'evaluate': {
        const policyRequest = {
          userId: url.searchParams.get('userId'),
          provider: url.searchParams.get('provider'),
          action: url.searchParams.get('action'),
        };
        const result = policyEngine.evaluate(policyRequest);
        return NextResponse.json(result);
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST — log events, add policies, track usage
export async function POST(request) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'log': {
        const entry = await auditLogger.log({
          userId: body.userId,
          action: body.eventAction ?? body.action,
          provider: body.provider,
          model: body.model,
          severity: body.severity ?? 'info',
          details: body.details,
          headers: body.headers,
          ip: body.ip,
        });
        return NextResponse.json(entry);
      }

      case 'add-policy': {
        policyEngine.addPolicy(body.policy);
        return NextResponse.json({ success: true, total: policyEngine.listPolicies().length });
      }

      case 'remove-policy': {
        policyEngine.removePolicy(body.policyId);
        return NextResponse.json({ success: true });
      }

      case 'track': {
        const usage = await usageTracker.track(body.userId ?? 'default', {
          tokens: body.tokens,
          cost: body.cost,
          provider: body.provider,
          model: body.model,
        });
        return NextResponse.json(usage);
      }

      case 'check-limits': {
        const result = usageTracker.checkLimits(body.userId ?? 'default');
        return NextResponse.json(result);
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
