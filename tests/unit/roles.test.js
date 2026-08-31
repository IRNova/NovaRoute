// Role matrix. Runs with: node --test "tests/unit/*.test.js"
import test from "node:test";
import assert from "node:assert/strict";

import { canAccess, normalizeRole, ROLES } from "../../src/lib/auth/roles.js";

test("admin can do everything", () => {
  for (const [method, path] of [
    ["DELETE", "/api/users/abc"],
    ["POST", "/api/keys"],
    ["POST", "/api/settings/database/restore"],
    ["POST", "/api/version/update"],
    ["GET", "/api/security/audit"],
  ]) {
    assert.equal(canAccess("admin", method, path).allowed, true, `${method} ${path}`);
  }
});

test("operator runs the gateway but cannot mint credentials or move the database", () => {
  for (const [method, path] of [
    ["GET", "/api/providers"],
    ["POST", "/api/providers"],
    ["POST", "/api/combos"],
    ["GET", "/api/usage"],
    ["POST", "/api/dashboard/nova/agents"],
  ]) {
    assert.equal(canAccess("operator", method, path).allowed, true, `${method} ${path} should be allowed`);
  }

  for (const [method, path] of [
    ["POST", "/api/keys"],
    ["DELETE", "/api/keys/abc"],
    ["GET", "/api/keys"],
    ["POST", "/api/users"],
    ["GET", "/api/users"],
    ["POST", "/api/settings/database/restore"],
    ["POST", "/api/version/update"],
    ["POST", "/api/auth/change-password"],
    ["GET", "/api/security/audit"],
    ["POST", "/api/oauth/cursor/auto-import"],
  ]) {
    const verdict = canAccess("operator", method, path);
    assert.equal(verdict.allowed, false, `${method} ${path} should be refused`);
    assert.match(verdict.reason, /admin/);
  }
});

test("viewer can read but never write", () => {
  assert.equal(canAccess("viewer", "GET", "/api/providers").allowed, true);
  assert.equal(canAccess("viewer", "GET", "/api/usage").allowed, true);

  for (const method of ["POST", "PATCH", "PUT", "DELETE"]) {
    const verdict = canAccess("viewer", method, "/api/providers");
    assert.equal(verdict.allowed, false, `${method} should be refused`);
    assert.match(verdict.reason, /read-only/);
  }
});

test("viewer cannot read credentials either", () => {
  for (const path of ["/api/keys", "/api/users", "/api/security/audit", "/api/settings/database"]) {
    assert.equal(canAccess("viewer", "GET", path).allowed, false, path);
  }
});

test("the gateway and dashboard pages are not the role gate's business", () => {
  assert.equal(canAccess("viewer", "POST", "/v1/chat/completions").allowed, true);
  assert.equal(canAccess("viewer", "GET", "/dashboard/usage").allowed, true);
});

test("an unknown or missing role degrades to operator, not admin", () => {
  assert.equal(normalizeRole("root"), "operator");
  assert.equal(normalizeRole(undefined), "operator");
  assert.equal(canAccess("root", "POST", "/api/keys").allowed, false);
  assert.deepEqual(ROLES, ["admin", "operator", "viewer"]);
});
