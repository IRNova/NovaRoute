import { NextResponse } from 'next/server';
import {
  createCircuit,
  observeCircuit,
  shouldAllowRequest,
  getCircuitHealth,
  ModelLockout,
  classifyFailure,
} from '@/lib/resilience/index.js';

// Global state
const circuits = new Map();
const lockout = new ModelLockout();

// GET — get status of all circuits + lockouts
export async function GET(request) {
  try {
    const url = new URL(request.url);
    const provider = url.searchParams.get('provider');

    if (provider) {
      const circuit = circuits.get(provider);
      const lockStatus = lockout.getStatus(provider, '*');
      return NextResponse.json({
        provider,
        circuit: circuit ? getCircuitHealth(circuit) : null,
        lockout: lockStatus,
      });
    }

    // Return all
    const allCircuits = {};
    for (const [id, circuit] of circuits.entries()) {
      allCircuits[id] = getCircuitHealth(circuit);
    }

    return NextResponse.json({
      circuits: allCircuits,
      lockouts: lockout.getAllLocked(),
      stats: lockout.getStats(),
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST — record events, classify failures, manage lockouts
export async function POST(request) {
  try {
    const body = await request.json();
    const { action, provider, event, error: err, reason, durationMs } = body;

    switch (action) {
      case 'record': {
        // Record a circuit event
        if (!circuits.has(provider)) {
          circuits.set(provider, createCircuit());
        }
        const circuit = observeCircuit(circuits.get(provider), event, { reason });
        circuits.set(provider, circuit);

        if (event === 'failure') {
          lockout.recordFailure(provider, body.model, err ? new Error(err) : null);
        } else if (event === 'success') {
          lockout.recordSuccess(provider, body.model);
        }

        return NextResponse.json({
          provider,
          circuit: getCircuitHealth(circuit),
          locked: lockout.isLocked(provider, body.model),
        });
      }

      case 'classify': {
        // Classify a failure
        const classification = classifyFailure(
          err ? new Error(err) : new Error('unknown'),
          body.statusCode
        );
        return NextResponse.json({ classification });
      }

      case 'lock': {
        lockout.lock(provider, body.model, durationMs, reason);
        return NextResponse.json({ locked: true, status: lockout.getStatus(provider, body.model) });
      }

      case 'unlock': {
        lockout.unlock(provider, body.model);
        return NextResponse.json({ unlocked: true });
      }

      case 'check': {
        const allowed = shouldAllowRequest(circuits.get(provider) ?? createCircuit());
        return NextResponse.json({ allowed, provider });
      }

      case 'cleanup': {
        lockout.cleanup();
        return NextResponse.json({ cleaned: true, stats: lockout.getStats() });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
