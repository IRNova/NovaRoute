import { NextResponse } from "next/server";
import { startUpdate } from "@/lib/updater/launch";

export const dynamic = "force-dynamic";

const BRANCH = process.env.NOVAROUTE_UPDATE_BRANCH || "main";

// POST /api/github-update/apply — body: { tag: "v1.2.3" } or {} for the branch.
//
// The repository has no releases, so a tag was never resolvable and this
// endpoint could not start anything. An empty body now updates from the
// tracked branch, which is what install.sh deploys from.
export async function POST(request) {
  let tag = "";
  try {
    const body = await request.json();
    tag = String(body?.tag || "").trim();
  } catch {
    /* empty body means "update from the branch" */
  }

  const job = tag ? { mode: "tag", ref: tag } : { mode: "git", ref: BRANCH };
  const result = startUpdate(job);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(
    { started: true, mode: job.mode, ref: job.ref, poll: "/api/github-update/status" },
    { status: 202 }
  );
}
