// Give plain `node --test` the two module aliases jsconfig.json gives Next,
// so unit tests can import app code directly:
//   @/x         -> <root>/src/x(.js | /index.js)
//   open-sse/x  -> <root>/open-sse/x
import { registerHooks } from "node:module";
import { existsSync, statSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function resolveAliased(rel) {
  const full = path.join(ROOT, rel);
  if (existsSync(full) && statSync(full).isDirectory()) return path.join(full, "index.js");
  if (existsSync(full)) return full;
  if (existsSync(`${full}.js`)) return `${full}.js`;
  return full;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    let rel = null;
    if (specifier.startsWith("@/")) rel = path.join("src", specifier.slice(2));
    else if (specifier.startsWith("open-sse/")) rel = specifier;
    if (rel) return { url: pathToFileURL(resolveAliased(rel)).href, shortCircuit: true };

    // App code also writes extensionless relative imports (`./config`), which
    // the bundler resolves and plain node does not.
    try {
      return nextResolve(specifier, context);
    } catch (err) {
      if (!specifier.startsWith(".") || specifier.endsWith(".js")) throw err;
      return nextResolve(`${specifier}.js`, context);
    }
  },
});

export const PROJECT_ROOT = ROOT;
