import { readFile } from "fs/promises";
import path from "path";
import { SKILLS } from "@/shared/constants/skills";

// Serve the agent skills bundled with this build.
//
// The /dashboard/skills page hands the user a URL to paste into an AI agent,
// which then fetches it and follows whatever instructions it finds. Those URLs
// used to be raw.githubusercontent.com links into the upstream author's repo,
// so the agent executed remote instructions from a repo nobody here controls,
// resolved fresh at the moment of the paste. Serving from this instance means
// the agent reads the file that shipped with the build you are running.

export const dynamic = "force-dynamic";

// Only ids in the registry are servable, so `id` can never walk the filesystem.
const ALLOWED = new Set(SKILLS.map((s) => s.id));

const CANDIDATES = [
  (id) => path.join(process.cwd(), "skills", id, "SKILL.md"),
  (id) => path.join(process.cwd(), "..", "skills", id, "SKILL.md"),
];

export async function GET(_request, { params }) {
  const { id } = await params;

  if (!ALLOWED.has(id)) {
    return new Response("Not found\n", { status: 404 });
  }

  for (const resolve of CANDIDATES) {
    try {
      const md = await readFile(resolve(id), "utf8");
      return new Response(md, {
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
          "Cache-Control": "no-store",
        },
      });
    } catch {
      // try the next location
    }
  }

  return new Response(
    `# ${id}\n\nThis skill was not bundled with this build.\n`,
    { status: 404, headers: { "Content-Type": "text/markdown; charset=utf-8" } }
  );
}
