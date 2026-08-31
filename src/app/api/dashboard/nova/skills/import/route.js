// Skills import API — pull skills from a JSON URL or inline array.
// Body: { url } (JSON: [{skill_name, content}...]) or { items: [...] }
// Auth enforced by the global /api middleware.
import { NextResponse } from "next/server";
import { addSkill } from "@/lib/nova/skills.js";
import { fetchSafely } from "@/lib/nova/sandbox.js";

export const dynamic = "force-dynamic";
const MAX_ITEMS = 100;

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    let items = Array.isArray(body?.items) ? body.items : null;

    if (!items && body?.url) {
      // fetchSafely resolves DNS and re-checks every redirect hop, so a public
      // URL cannot bounce this fetch into the local network.
      let res;
      try {
        ({ res } = await fetchSafely(body.url, { timeoutMs: 20_000 }));
      } catch (e) {
        return NextResponse.json({ error: String(e?.message || "blocked URL") }, { status: 400 });
      }
      const status = res.statusCode ?? res.status;
      if (status >= 400) return NextResponse.json({ error: `HTTP ${status}` }, { status: 502 });
      const json = await res.json().catch(() => null);
      items = Array.isArray(json) ? json : Array.isArray(json?.skills) ? json.skills : null;
    }

    if (!items?.length) {
      return NextResponse.json({ error: "no items found (expected [{skill_name, content}])" }, { status: 400 });
    }

    let imported = 0;
    for (const it of items.slice(0, MAX_ITEMS)) {
      const name = String(it?.skill_name || it?.name || "").trim().slice(0, 120);
      const content = String(it?.content || "").trim().slice(0, 2000);
      if (!name || !content) continue;
      await addSkill("", name, content, "imported");
      imported++;
    }
    return NextResponse.json({ ok: true, imported });
  } catch (error) {
    console.error("[api-err]", error?.stack || error);
    return NextResponse.json({ error: error?.message || "import failed" }, { status: 500 });
  }
}
