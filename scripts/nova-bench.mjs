#!/usr/bin/env node
// Gateway overhead benchmark.
//
//   node scripts/nova-bench.mjs --url http://127.0.0.1:20126 --key sk-... \
//        [--duration 15] [--concurrency 16] [--model gpt-4o-mini]
//
// Measures what NovaRoute itself costs, not what a provider costs:
//   health   → the Next.js/runtime floor (no auth, no database)
//   models   → auth + key policy + registry + database read
//   chat     → the full path, only when --model is given AND that model is
//              configured; upstream time is included, so read it as
//              "end to end", never as gateway overhead.
//
// No dependencies. Numbers are p50/p90/p99 in milliseconds plus requests/sec.

const args = process.argv.slice(2);
const arg = (name, dflt = null) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : dflt;
};

const BASE = (arg("url", "http://127.0.0.1:20126") || "").replace(/\/$/, "");
const KEY = arg("key", process.env.NOVA_BENCH_KEY || "");
const DURATION_S = Number(arg("duration", 10));
const CONCURRENCY = Number(arg("concurrency", 8));
const MODEL = arg("model", "");
const WARMUP = Number(arg("warmup", 30));

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

async function once(url, init) {
  const started = performance.now();
  try {
    const res = await fetch(url, init);
    await res.arrayBuffer();
    return { ms: performance.now() - started, status: res.status };
  } catch (e) {
    return { ms: performance.now() - started, status: 0, error: e.message };
  }
}

async function run({ name, url, init, durationS = DURATION_S, concurrency = CONCURRENCY }) {
  // Warm up so JIT and first-hit compilation do not land in the numbers.
  for (let i = 0; i < WARMUP; i++) await once(url, init);

  const samples = [];
  const statuses = new Map();
  const deadline = performance.now() + durationS * 1000;

  const worker = async () => {
    while (performance.now() < deadline) {
      const r = await once(url, init);
      samples.push(r.ms);
      statuses.set(r.status, (statuses.get(r.status) || 0) + 1);
    }
  };
  const startedAt = performance.now();
  await Promise.all(Array.from({ length: concurrency }, worker));
  const elapsedS = (performance.now() - startedAt) / 1000;

  const sorted = [...samples].sort((a, b) => a - b);
  return {
    name,
    requests: samples.length,
    rps: samples.length / elapsedS,
    p50: percentile(sorted, 50),
    p90: percentile(sorted, 90),
    p99: percentile(sorted, 99),
    max: sorted[sorted.length - 1] || 0,
    statuses: Object.fromEntries(statuses),
  };
}

function report(rows) {
  const fmt = (n) => n.toFixed(1).padStart(8);
  console.log("");
  console.log(`  target      ${BASE}`);
  console.log(`  concurrency ${CONCURRENCY}, ${DURATION_S}s per scenario, ${WARMUP} warmup requests`);
  console.log("");
  console.log("  scenario        requests      rps      p50      p90      p99      max");
  console.log("  " + "-".repeat(70));
  for (const r of rows) {
    console.log(
      `  ${r.name.padEnd(14)}${String(r.requests).padStart(8)} ${fmt(r.rps)} ${fmt(r.p50)} ${fmt(r.p90)} ${fmt(r.p99)} ${fmt(r.max)}`
    );
  }
  console.log("");
  for (const r of rows) {
    const codes = Object.entries(r.statuses).map(([k, v]) => `${k}×${v}`).join(" ");
    console.log(`  ${r.name}: ${codes}`);
  }
  console.log("");
}

const authHeaders = KEY ? { Authorization: `Bearer ${KEY}` } : {};
const scenarios = [
  { name: "health", url: `${BASE}/api/health`, init: { method: "GET" } },
  { name: "models", url: `${BASE}/v1/models`, init: { method: "GET", headers: authHeaders } },
];

if (MODEL) {
  scenarios.push({
    name: "chat",
    url: `${BASE}/v1/chat/completions`,
    init: {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, messages: [{ role: "user", content: "ping" }], max_tokens: 8 }),
    },
    // A real upstream call is slow and costs money: fewer, gentler samples.
    durationS: Math.min(DURATION_S, 10),
    concurrency: Math.min(CONCURRENCY, 4),
  });
}

const results = [];
for (const scenario of scenarios) {
  process.stdout.write(`running ${scenario.name}… `);
  results.push(await run(scenario));
  process.stdout.write("done\n");
}
report(results);

const failed = results.find((r) => Object.keys(r.statuses).some((s) => s === "0" || Number(s) >= 500));
process.exit(failed ? 1 : 0);
