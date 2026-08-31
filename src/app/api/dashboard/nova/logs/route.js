// Nova logs API — read recent structured log entries (ring buffer) and/or
// tail the on-disk app logs. Supports level filter + text query + clear.
import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

function listLogFiles() {
  try {
    return fs
      .readdirSync(logger.logsDir)
      .filter((f) => f.endsWith(".log"))
      .map((f) => path.join(logger.logsDir, f))
      .sort();
  } catch {
    return [];
  }
}

function tailFile(file, lines) {
  try {
    const data = fs.readFileSync(file, "utf8");
    const arr = data.split("\n");
    return arr.slice(Math.max(0, arr.length - lines));
  } catch {
    return [];
  }
}

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const q = (url.searchParams.get("q") || "").toLowerCase();
    const level = url.searchParams.get("level") || "";
    const limit = Math.min(parseInt(url.searchParams.get("limit"), 10) || 300, 2000);
    const source = url.searchParams.get("source") || "memory"; // memory | file

    let entries = [];

    if (source === "file") {
      for (const f of listLogFiles().slice(-3)) entries.push(...tailFile(f, limit));
      entries = entries.filter(Boolean).slice(-limit);
    } else {
      entries = logger.ring().map((e) => JSON.stringify(e));
    }

    if (level) entries = entries.filter((l) => l.includes(`"lvl":"${level}"`));
    if (q) entries = entries.filter((l) => l.toLowerCase().includes(q));

    return NextResponse.json({ ok: true, count: entries.length, entries: entries.slice(-limit) });
  } catch (error) {
    console.error("[api-err]", error?.stack || error);
    return NextResponse.json({ error: error?.message || "failed" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    logger.ring().length = 0;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error?.message || "failed" }, { status: 500 });
  }
}
