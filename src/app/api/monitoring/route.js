import { NextResponse } from 'next/server';
import { MetricsCollector, HealthChecker, AlertManager, compileCondition } from '@/lib/monitoring/index.js';
import { makeKv } from '@/lib/db/helpers/kvStore.js';

const metrics = new MetricsCollector();
const healthChecker = new HealthChecker();
const alertManager = new AlertManager();

// Metric snapshot persistence: counters/gauges/histograms are restored after a
// restart and re-saved periodically + after each POST mutation.
const monitoringKv = makeKv('monitoring');
let metricsRestored = false;
let persistTimerStarted = false;

async function restoreMetrics() {
  if (metricsRestored) return;
  metricsRestored = true;
  try {
    const snap = await monitoringKv.get('metricsSnapshot', null);
    if (!snap || typeof snap !== 'object') return;
    for (const [k, v] of Object.entries(snap.counters || {})) {
      if (typeof v === 'number') metrics.counters.set(k, v);
    }
    for (const [k, v] of Object.entries(snap.gauges || {})) {
      if (typeof v === 'number') metrics.gauges.set(k, { value: v, updatedAt: Date.now() });
    }
    for (const [k, h] of Object.entries(snap.histograms || {})) {
      if (!h || typeof h !== 'object' || !(h.count > 0)) continue;
      const avg = typeof h.avg === 'number' ? h.avg : 0;
      metrics.histograms.set(k, {
        values: [],
        count: h.count,
        sum: avg * h.count,
        min: Number.isFinite(h.min) ? h.min : Infinity,
        max: Number.isFinite(h.max) ? h.max : -Infinity,
      });
    }
  } catch {}
  startPeriodicPersist();
}

async function persistMetrics() {
  try {
    await monitoringKv.set('metricsSnapshot', metrics.snapshot());
  } catch {}
}

function startPeriodicPersist() {
  if (persistTimerStarted) return;
  persistTimerStarted = true;
  const handle = setInterval(() => persistMetrics(), 5 * 60 * 1000);
  if (handle.unref) handle.unref();
}

// Register default health checks
healthChecker.register('server', async () => ({ status: 'healthy', message: 'Server is running' }));
healthChecker.register('memory', async () => {
  const usage = process.memoryUsage();
  const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
  return {
    status: heapUsedMB < 500 ? 'healthy' : 'degraded',
    message: `Heap: ${heapUsedMB}MB`,
  };
});
healthChecker.register('uptime', async () => ({
  status: 'healthy',
  message: `Uptime: ${Math.round(process.uptime())}s`,
}));

// GET — get metrics, health status, or alerts
export async function GET(request) {
  try {
    await restoreMetrics();
    const url = new URL(request.url);
    const action = url.searchParams.get('action') ?? 'status';

    switch (action) {
      case 'status': {
        const health = await healthChecker.checkAll();
        const snapshot = metrics.snapshot();
        return NextResponse.json({ health, metrics: snapshot });
      }

      case 'metrics': {
        const name = url.searchParams.get('name');
        if (name) {
          const histStats = metrics.getHistogram(name);
          return NextResponse.json({ name, histogram: histStats });
        }
        return NextResponse.json(metrics.snapshot());
      }

      case 'health': {
        const health = await healthChecker.checkAll();
        return NextResponse.json(health);
      }

      case 'health-check': {
        const checkName = url.searchParams.get('check');
        if (checkName) {
          const result = await healthChecker.check(checkName);
          return NextResponse.json(result);
        }
        const all = await healthChecker.checkAll();
        return NextResponse.json(all);
      }

      case 'alerts': {
        const severity = url.searchParams.get('severity');
        const alerts = alertManager.getAlerts(severity);
        return NextResponse.json({ alerts, total: alerts.length });
      }

      case 'counter': {
        const counterName = url.searchParams.get('name');
        const value = metrics.getCounter(counterName);
        return NextResponse.json({ name: counterName, value });
      }

      case 'gauge': {
        const gaugeName = url.searchParams.get('name');
        const value = metrics.getGauge(gaugeName);
        return NextResponse.json({ name: gaugeName, value });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST — record metrics, evaluate alerts, manage health checks
export async function POST(request) {
  try {
    await restoreMetrics();
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'increment': {
        metrics.increment(body.name, body.value, body.tags);
        persistMetrics();
        return NextResponse.json({ name: body.name, value: metrics.getCounter(body.name, body.tags) });
      }

      case 'gauge': {
        metrics.gauge(body.name, body.value, body.tags);
        persistMetrics();
        return NextResponse.json({ name: body.name, value: body.value });
      }

      case 'histogram': {
        metrics.histogram(body.name, body.value, body.tags);
        persistMetrics();
        return NextResponse.json({ name: body.name, stats: metrics.getHistogram(body.name, body.tags) });
      }

      case 'evaluate-alerts': {
        const snapshot = metrics.snapshot();
        const triggered = alertManager.evaluate(snapshot);
        return NextResponse.json({ triggered, total: triggered.length });
      }

      case 'add-alert-rule': {
        // Declarative only: { condition: { source, metric, stat, op, value } }.
        // `conditionFn` (a JS string compiled with new Function) used to be
        // accepted here — that was arbitrary code execution in the gateway.
        if (body.conditionFn !== undefined) {
          return NextResponse.json(
            {
              error:
                'conditionFn is no longer supported. Use condition: { source: "counters"|"gauges"|"histograms", metric, stat, op, value }.',
            },
            { status: 400 }
          );
        }
        let condition;
        try {
          condition = compileCondition(body.condition);
        } catch (err) {
          return NextResponse.json({ error: err.message }, { status: 400 });
        }
        alertManager.addRule({
          name: body.name,
          condition,
          conditionSpec: body.condition,
          severity: body.severity,
          message: body.message,
          cooldownMs: body.cooldownMs,
        });
        return NextResponse.json({ success: true });
      }

      case 'silence-alert': {
        alertManager.silence(body.ruleId, body.durationMs);
        return NextResponse.json({ silenced: true });
      }

      case 'clear-alert': {
        alertManager.clear(body.alertId);
        return NextResponse.json({ cleared: true });
      }

      case 'reset-metrics': {
        metrics.reset();
        return NextResponse.json({ reset: true });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
