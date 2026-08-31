import { readFile } from "fs/promises";
import path from "path";

// Serve the CHANGELOG.md that shipped with this build.
//
// This replaces a runtime fetch of the upstream author's repo. That fetch had
// two problems: the notes described whatever was on someone else's master
// branch rather than the build actually running, and the panel renders the
// markdown as HTML, so a third party controlled markup inside the dashboard.
// Reading the bundled file removes both.

export const dynamic = "force-dynamic";

// next.config.mjs copies CHANGELOG.md next to the standalone server on build,
// so process.cwd() resolves in dev and in the packaged output alike.
const CANDIDATES = [
  () => path.join(process.cwd(), "CHANGELOG.md"),
  () => path.join(process.cwd(), "..", "CHANGELOG.md"),
];

export async function GET() {
  for (const resolve of CANDIDATES) {
    try {
      const md = await readFile(resolve(), "utf8");
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
  return new Response("# Changelog\n\nNo CHANGELOG.md was bundled with this build.\n", {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
