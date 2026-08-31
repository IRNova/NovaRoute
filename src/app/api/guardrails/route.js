import { NextResponse } from 'next/server';
import { scanPII } from '@/lib/guardrails/piiMasker.js';
import { scanCredentials } from '@/lib/guardrails/credentialMasker.js';
import {
  getSharedRegistry,
  persistGuardrailStates,
  isGatewayEnforcementEnabled,
  setGatewayEnforcement,
} from '@/lib/guardrails/sharedRegistry.js';

// GET — list all guardrails and their status (+ gateway enforcement flag)
export async function GET(request) {
  try {
    const reg = await getSharedRegistry();
    const guardrails = reg.list();

    return NextResponse.json({
      guardrails,
      total: guardrails.length,
      enabled: guardrails.filter(g => g.enabled).length,
      gatewayEnabled: await isGatewayEnforcementEnabled(),
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST — run guardrails against messages, or scan for PII/credentials
export async function POST(request) {
  try {
    const body = await request.json();
    const { action, messages, text, options } = body;

    const reg = await getSharedRegistry();

    switch (action) {
      case 'check': {
        // Run all guardrails against messages
        const result = await reg.run({
          messages: messages ?? [],
          provider: body.provider,
          model: body.model,
          requestId: body.requestId,
        });
        return NextResponse.json(result);
      }

      case 'scan-pii': {
        // Scan text for PII
        const detections = scanPII(text ?? '', options);
        return NextResponse.json({ detections, total: detections.length });
      }

      case 'scan-credentials': {
        // Scan text for credentials
        const detections = scanCredentials(text ?? '', options);
        return NextResponse.json({ detections, total: detections.length });
      }

      case 'toggle': {
        // Toggle a guardrail on/off (persisted across restarts)
        const { guardrailName, enabled } = body;
        const g = reg.guardrails.find(g => g.name === guardrailName);
        if (!g) return NextResponse.json({ error: `Guardrail '${guardrailName}' not found` }, { status: 404 });
        g.enabled = enabled;
        await persistGuardrailStates(reg);
        return NextResponse.json({ name: g.name, enabled: g.enabled });
      }

      case 'set-gateway-enabled': {
        const gatewayEnabled = await setGatewayEnforcement(body.enabled);
        return NextResponse.json({ gatewayEnabled });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
