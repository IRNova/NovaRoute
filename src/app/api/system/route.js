import { NextResponse } from "next/server";
import os from "node:os";
import fs from "node:fs";
import { getAdapter } from "@/lib/db/driver.js";
import { DATA_FILE } from "@/lib/db/paths.js";

function cpuUsagePercent() {
  const cpus = os.cpus();
  if (!cpus.length) return 0;
  let total = 0;
  let idle = 0;
  for (const cpu of cpus) {
    for (const [key, value] of Object.entries(cpu.times)) total += value;
    idle += cpu.times.idle;
  }
  if (total === 0) return 0;
  return Math.round(((total - idle) / total) * 10000) / 100;
}

export async function GET() {
  try {
    const mem = process.memoryUsage();
    let dbInfo = { driver: "unknown", sizeMB: 0, tables: [], migrations: 0, lastMigration: null };
    try {
      const db = await getAdapter();
      const tables = db.all(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`).map((r) => r.name);
      try {
        db.get(`SELECT 1 FROM sqlite_master LIMIT 1`);
      } catch {}
      let sizeMB = 0;
      try {
        sizeMB = Math.round((fs.statSync(DATA_FILE).size / (1024 * 1024)) * 100) / 100;
      } catch {}
      dbInfo = {
        driver: db.driver || "unknown",
        sizeMB,
        tables,
        migrations: tables.includes("migrations") ? db.all(`SELECT * FROM migrations`).length : 0,
        lastMigration: null,
      };
    } catch {}

    return NextResponse.json({
      version: process.env.npm_package_version || "0.0.1-beta",
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      uptime: process.uptime(),
      uptimeSeconds: Math.floor(process.uptime()),
      memory: {
        rssMB: Math.round(mem.rss / (1024 * 1024)),
        heapUsedMB: Math.round(mem.heapUsed / (1024 * 1024)),
        heapTotalMB: Math.round(mem.heapTotal / (1024 * 1024)),
        externalMB: Math.round(mem.external / (1024 * 1024)),
      },
      cpu: {
        cores: os.cpus().length,
        model: os.cpus()[0]?.model || "unknown",
        usagePercent: cpuUsagePercent(),
        loadAvg: os.loadavg().map((v) => Math.round(v * 100) / 100),
      },
      process: {
        pid: process.pid,
        ppid: process.ppid || 0,
        user: os.userInfo().username,
      },
      db: dbInfo,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
