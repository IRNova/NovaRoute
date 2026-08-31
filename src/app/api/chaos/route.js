/**
 * Chaos Engineering API — /api/chaos
 * 
 * GET    — List active experiments + catalog
 * POST   — Start a chaos experiment
 * DELETE — Stop a chaos experiment
 */

const { getChaosManager, CHAOS_EXPERIMENTS } = require('@/lib/chaos/chaosConfig');

// GET — List experiments
export async function GET(req) {
  const manager = getChaosManager();
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action') || 'active';

  if (action === 'catalog') {
    return Response.json({
      experiments: CHAOS_EXPERIMENTS,
      types: Object.keys(require('@/lib/chaos/chaosConfig').ChaosExperimentType),
    });
  }

  if (action === 'history') {
    return Response.json({ history: manager.getHistory(100) });
  }

  if (action === 'stats') {
    return Response.json(manager.stats());
  }

  return Response.json({
    active: manager.getActive(),
    stats: manager.stats(),
  });
}

// POST — Start experiment
export async function POST(req) {
  try {
    const body = await req.json();
    const { experimentId, overrides } = body;

    if (!experimentId) {
      return Response.json({ error: 'experimentId required' }, { status: 400 });
    }

    const manager = getChaosManager();
    const experiment = manager.startExperiment(experimentId, overrides);

    return Response.json({
      success: true,
      experiment: {
        id: experiment.id,
        type: experiment.type,
        severity: experiment.severity,
        status: experiment.status,
        startedAt: experiment.startedAt,
      },
    });
  } catch (err) {
    return Response.json(
      { error: err.message || 'Failed to start experiment' },
      { status: 500 }
    );
  }
}

// DELETE — Stop experiment
export async function DELETE(req) {
  const { searchParams } = new URL(req.url);
  const experimentId = searchParams.get('experimentId');

  if (!experimentId) {
    return Response.json({ error: 'experimentId required' }, { status: 400 });
  }

  const manager = getChaosManager();
  manager.stopExperiment(experimentId);

  return Response.json({ success: true, experimentId });
}
