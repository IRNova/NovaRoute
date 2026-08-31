// Export the full skills library as importable JSON (skills sync).
import { NextResponse } from "next/server";
import { getAllSkills } from "@/lib/nova/skills.js";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const skills = await getAllSkills("");
    return NextResponse.json({
      ok: true,
      version: 1,
      exportedAt: new Date().toISOString(),
      skills: skills.map((s) => ({ skill_name: s.skill_name, content: s.content, source: s.source, usage_count: s.usage_count })),
    });
  } catch (error) {
    console.error("[api-err]", error?.stack || error);
    return NextResponse.json({ error: error?.message || "failed" }, { status: 500 });
  }
}
