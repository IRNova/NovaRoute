// Nova Bot integration tools. Runs with: node --test "tests/unit/*.test.js"
//
// The bot could describe a GitHub account it had no way to change: every tool
// was read-only, so "create a repository" had no tool behind it at all. Writes
// exist now, and each one goes past a human first, because the same PAT that
// creates a repository can delete one.
import test from "node:test";
import assert from "node:assert/strict";
import "./aliasHook.mjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const integrations = fs.readFileSync(path.join(ROOT, "src/lib/nova/integrations.js"), "utf8");
// Comments explain the bugs these tests guard, and naming a broken path in a
// comment must not read as the broken path still being in the code.
const integrationsCode = integrations
  .split("\n")
  .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
  .join("\n");
const tools3 = fs.readFileSync(path.join(ROOT, "src/lib/nova/tools3.js"), "utf8");

const WRITE_TOOLS = [
  "gh_create_repo", "gh_create_issue", "gh_create_branch", "gh_put_file", "gh_create_pr",
  "cf_create_dns", "cf_update_dns", "cf_delete_dns", "cf_purge_cache",
];

test("every write tool is declared to the model", () => {
  for (const name of WRITE_TOOLS) {
    assert.ok(tools3.includes(`name: "${name}"`), `${name} is not declared, so the model cannot call it`);
  }
});

test("every write tool is dispatched", () => {
  // A declared tool with no case in the switch returns null and the model is
  // told nothing useful.
  for (const name of WRITE_TOOLS) {
    assert.ok(tools3.includes(`case "${name}":`), `${name} is declared but never dispatched`);
  }
});

test("every write implementation asks for approval", () => {
  const impls = [
    "ghCreateRepo", "ghCreateIssue", "ghCreateBranch", "ghPutFile", "ghCreatePr",
    "cfCreateDns", "cfUpdateDns", "cfDeleteDns", "cfPurgeCache",
  ];
  for (const fn of impls) {
    const start = integrations.indexOf(`export async function ${fn}(`);
    assert.ok(start > -1, `${fn} is missing`);
    const next = integrations.indexOf("\nexport async function ", start + 1);
    const body = integrations.slice(start, next === -1 ? undefined : next);
    assert.ok(body.includes("approveWrite("), `${fn} writes without an approval gate`);
  }
});

test("the approval line names the record before a DNS delete", () => {
  // Approving "delete record 3f2b..." tells the admin nothing. The record is
  // fetched first so the prompt says what actually disappears.
  const start = integrations.indexOf("export async function cfDeleteDns(");
  const body = integrations.slice(start, start + 900);
  const fetchAt = body.indexOf("cfFetch(");
  const approveAt = body.indexOf("approveWrite(");
  assert.ok(fetchAt > -1 && approveAt > fetchAt, "the record must be read before the approval prompt");
  assert.ok(/approveWrite\(\s*`Cloudflare: DELETE \$\{r\.type\} \$\{r\.name\}/.test(body));
});

test("read-only tools are not gated, or the bot could not answer a question", () => {
  for (const fn of ["ghListRepos", "ghGetRepo", "cfListZones", "cfListDns"]) {
    const start = integrations.indexOf(`export async function ${fn}(`);
    const next = integrations.indexOf("\nexport async function ", start + 1);
    const body = integrations.slice(start, next === -1 ? undefined : next);
    assert.ok(!body.includes("approveWrite("), `${fn} is read-only and must not need approval`);
  }
});

test("a repository name cannot smuggle a path into the API call", () => {
  // The name is interpolated into an API request, and GitHub would happily
  // treat a slash as a path segment.
  const start = integrations.indexOf("export async function ghCreateRepo(");
  const body = integrations.slice(start, start + 700);
  assert.ok(/\^\[A-Za-z0-9\._-\]\{1,100\}\$/.test(body), "repo name is not validated");
});

test("the Cloudflare account id is resolved instead of being left out of the path", () => {
  // /accounts/workers/scripts has no account id and cannot match a route.
  assert.ok(!integrationsCode.includes("/accounts/workers/scripts"), "the malformed workers path is back");
  assert.ok(integrations.includes("async function cfAccount()"), "no account resolver");
  assert.ok(integrations.includes("/accounts/${account}/workers/scripts"));
});

test("only DNS deletion is destructive, and it is the only delete", () => {
  const deletes = [...integrations.matchAll(/method:\s*"DELETE"/g)];
  assert.equal(deletes.length, 1, "a new destructive call appeared; it needs its own review");
});
