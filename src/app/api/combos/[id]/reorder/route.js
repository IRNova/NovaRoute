import { NextResponse } from "next/server";
import { requireManagementAuth } from "@/lib/requireManagementAuth";
import { getComboById, updateCombo } from "@/lib/db/repos/combosRepo.js";
import { getModelStats } from "open-sse/routing/predictor.js";

export const dynamic = "force-dynamic";

const MIN_SAMPLES = 5;

// POST /api/combos/[id]/reorder — learning failover: reorder the combo's
// models by observed success rate for a task type (routingStats telemetry).
// Models without enough samples stay neutral (0.5) so low-data models don't
// jump the queue.
export async function POST(request, { params }) {
  const rejection = await requireManagementAuth(request);
  if (rejection) return rejection;
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const taskType = body?.taskType || "general";

    const combo = await getComboById(id);
    if (!combo) return NextResponse.json({ error: "Combo not found" }, { status: 404 });
    if (!Array.isArray(combo.models) || combo.models.length < 2) {
      return NextResponse.json({ error: "Combo needs at least 2 models" }, { status: 400 });
    }

    const stats = await getModelStats(taskType);
    const statMap = {};
    for (const s of stats) statMap[`${s.provider}|${s.model}`] = s;

    const score = (fullModel) => {
      const [provider, ...rest] = String(fullModel).split("/");
      const model = rest.join("/");
      const candidates = [
        `${provider}|${model}`,
        `${provider}|${model.split("/").pop()}`,
      ];
      let best = null;
      for (const key of candidates) {
        const s = statMap[key];
        if (s && s.samples >= MIN_SAMPLES) {
          best = s;
          break;
        }
      }
      if (!best) return { rate: 0.5, samples: 0 };
      return { rate: best.successRate, samples: best.samples };
    };

    const scored = combo.models.map((m) => ({ m, ...score(m) }));
    scored.sort((a, b) => b.rate - a.rate);
    const ordered = scored.map((s) => s.m);

    await updateCombo(id, { models: ordered });

    return NextResponse.json({
      success: true,
      ordered,
      scoring: scored.map((s) => ({ model: s.m, successRate: Math.round(s.rate * 100), samples: s.samples })),
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
