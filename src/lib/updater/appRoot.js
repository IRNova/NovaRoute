// Where the application is actually installed.
//
// Nothing may derive this from process.cwd(). The Next standalone server calls
// `process.chdir(__dirname)` on boot, so a running install reports
// <install>/.next/standalone as its working directory, not the checkout. Code
// that trusted cwd looked for .git in the build output (and reported the
// install as "not a git checkout"), and would have run `npm install` and
// `npm run build` inside .next/standalone, which has its own package.json.
import fs from "node:fs";
import path from "node:path";

// The build output is not a decoy that can be ruled out by package.json alone:
// .next/standalone has its own package.json AND a traced copy of src/, so both
// of those match there too. next.config.mjs is a build INPUT and is never
// emitted into the output, which makes it the reliable marker.
const ROOT_MARKERS = ["next.config.mjs", "install.sh", "jsconfig.json"];

function looksLikeAppRoot(dir) {
  try {
    if (!fs.existsSync(path.join(dir, "package.json"))) return false;
    return ROOT_MARKERS.some((m) => fs.existsSync(path.join(dir, m)));
  } catch {
    return false;
  }
}

export function resolveAppRoot(start = process.cwd()) {
  const configured = process.env.INSTALL_DIR;
  if (configured && looksLikeAppRoot(configured)) return configured;

  let dir = path.resolve(start);
  for (let i = 0; i < 8; i += 1) {
    if (looksLikeAppRoot(dir)) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // Nothing recognisable: the caller decides what to do, and canSelfUpdate()
  // will refuse rather than operate on a directory we cannot identify.
  return configured || path.resolve(start);
}
