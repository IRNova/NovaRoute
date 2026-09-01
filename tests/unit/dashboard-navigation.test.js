// Dashboard reachability. Runs with: node --test "tests/unit/*.test.js"
//
// The panel had 83 routes and the sidebar linked 27. Around 25 real pages had
// no inbound link from anywhere in the app, so several thousand lines of
// working UI could only be reached by typing a URL. These tests keep every
// page reachable and keep the settings tabs matching the settings pages.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const DASH = path.join(ROOT, "src/app/(dashboard)/dashboard");

function walkJs(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walkJs(full, acc);
    else if (e.name.endsWith(".js")) acc.push(full);
  }
  return acc;
}

function routes() {
  const out = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
    }
    if (fs.existsSync(path.join(dir, "page.js"))) {
      out.push("/dashboard" + dir.slice(DASH.length));
    }
  };
  walk(DASH);
  return out.filter((r) => !r.includes("["));
}

const allSource = walkJs(path.join(ROOT, "src"))
  .map((f) => fs.readFileSync(f, "utf8"))
  .join("\n");

function isRedirectOnly(route) {
  const file = path.join(DASH, route.replace("/dashboard", ""), "page.js");
  if (!fs.existsSync(file)) return false;
  const s = fs.readFileSync(file, "utf8");
  // Three redirect styles are in use: next/navigation redirect(), a router
  // push in an effect, and a bare window.location.replace.
  return s.includes("redirect(") || s.includes("useRouter") || s.includes("location.replace(");
}

test("every dashboard page is linked from somewhere", () => {
  const unreachable = [];
  for (const route of routes()) {
    if (route === "/dashboard") continue;
    // Settings pages are linked by the shell as `/dashboard/settings/${tab}`,
    // a template literal no string match can see. The tab list is checked
    // against the settings directories by its own test below.
    if (route.startsWith("/dashboard/settings/")) continue;
    // A page that only forwards elsewhere does not need an inbound link.
    if (isRedirectOnly(route)) continue;
    // Its own file mentioning its path does not count as an inbound link, so
    // look for the path appearing in a link or a nav table anywhere.
    const linked =
      allSource.includes(`href: "${route}"`) ||
      allSource.includes(`href="${route}"`) ||
      allSource.includes(`push("${route}")`) ||
      allSource.includes(`redirect("${route}")`);
    if (!linked) unreachable.push(route);
  }
  assert.deepEqual(unreachable, [], "these pages cannot be reached from the UI");
});

test("the settings navigation covers every settings page", () => {
  const shell = fs.readFileSync(path.join(DASH, "settings/SettingsShell.js"), "utf8");
  const tabs = new Set([...shell.matchAll(/value: "([a-z-]+)"/g)].map((m) => m[1]));
  const dir = path.join(DASH, "settings");
  const missing = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const page = path.join(dir, e.name, "page.js");
    if (!fs.existsSync(page)) continue;
    if (fs.readFileSync(page, "utf8").includes("redirect(")) continue;
    if (!tabs.has(e.name)) missing.push(e.name);
  }
  assert.deepEqual(missing, [], "settings pages with no tab can only be reached by URL");
});

test("no settings tab points at a page that does not exist", () => {
  const shell = fs.readFileSync(path.join(DASH, "settings/SettingsShell.js"), "utf8");
  const tabs = [...shell.matchAll(/value: "([a-z-]+)"/g)].map((m) => m[1]);
  for (const t of tabs) {
    assert.ok(fs.existsSync(path.join(DASH, "settings", t, "page.js")), `settings tab "${t}" has no page`);
  }
});

test("the tools index only links pages that exist", () => {
  const more = fs.readFileSync(path.join(DASH, "more/MoreClient.js"), "utf8");
  const hrefs = [...more.matchAll(/href: "(\/dashboard[^"]*)"/g)].map((m) => m[1]);
  assert.ok(hrefs.length > 15, `expected the index to cover the orphans, found ${hrefs.length}`);
  for (const h of hrefs) {
    const file = path.join(DASH, h.replace("/dashboard", ""), "page.js");
    assert.ok(fs.existsSync(file), `the index links ${h}, which has no page`);
  }
});
