// Agent memory recall: FTS5 ranking with a LIKE fallback.
// Runs against a real in-memory SQLite via node:sqlite.
import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";

import {
  searchMemories,
  extractTerms,
  buildMatchQuery,
  __resetIndexStateForTests,
} from "../../src/lib/nova/memorySearch.js";

// Minimal stand-in for the app's database adapter.
function makeDb() {
  __resetIndexStateForTests();
  const db = new DatabaseSync(":memory:");
  db.exec(`CREATE TABLE nova_memory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL DEFAULT '',
    agent_name TEXT NOT NULL DEFAULT '',
    kind TEXT NOT NULL DEFAULT 'memory',
    content TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`);
  return {
    raw: db,
    exec: (sql) => db.exec(sql),
    get: (sql, params = []) => db.prepare(sql).get(...params),
    all: (sql, params = []) => db.prepare(sql).all(...params),
    run: (sql, params = []) => db.prepare(sql).run(...params),
  };
}

// Rows are inserted oldest → newest. Several of them contain a query term but
// are irrelevant, and the irrelevant ones are the NEWEST — so an implementation
// that returns "newest row containing any term" (what this replaced) fails
// these tests.
function seed(db) {
  let clock = Date.parse("2026-01-01T00:00:00.000Z");
  const insert = (kind, content, agent = "ops") => {
    clock += 60_000;
    db.run(
      `INSERT INTO nova_memory(session_id, agent_name, kind, content, created_at) VALUES(?,?,?,?,?)`,
      ["s1", agent, kind, content, new Date(clock).toISOString()]
    );
  };
  insert("skill", "To restart nginx safely, check the config with nginx -t before reloading.");
  insert("skill", "Postgres backups live in /var/backups and rotate weekly.");
  insert("memory", "Someone should reload the dishwasher before the weekend.");
  insert("memory", "Remember to restart the coffee machine on Mondays.");
  insert("skill", "Kubernetes rollouts should be watched with kubectl rollout status.", "deploy");
}

// Same single matching term in both rows, note written AFTER the skill: only a
// skill preference (not recency) puts the skill first.
function seedTie(db) {
  db.run(
    `INSERT INTO nova_memory(session_id, agent_name, kind, content, created_at) VALUES(?,?,?,?,?)`,
    ["s1", "ops", "skill", "Grafana dashboards are provisioned from git.", "2026-01-01T00:00:00.000Z"]
  );
  db.run(
    `INSERT INTO nova_memory(session_id, agent_name, kind, content, created_at) VALUES(?,?,?,?,?)`,
    ["s1", "ops", "memory", "Grafana was mentioned in passing yesterday.", "2026-02-01T00:00:00.000Z"]
  );
}

test("recall ranks the relevant memory first, not the newest one", () => {
  const db = makeDb();
  seed(db);
  const { rows, engine } = searchMemories(db, { agentName: "ops", text: "how do I restart nginx?", limit: 3 });
  assert.ok(rows.length > 0, "expected a match");
  assert.match(
    rows[0].content,
    /nginx -t/,
    "the nginx skill must win over the newer coffee-machine note that also says restart"
  );
  assert.ok(["fts5", "like"].includes(engine));
});

test("on an equal match, a learned skill beats a newer plain note", () => {
  const db = makeDb();
  seedTie(db);
  const { rows } = searchMemories(db, { agentName: "ops", text: "grafana", limit: 5 });
  assert.equal(rows.length, 2);
  assert.equal(rows[0].kind, "skill");
});

test("another agent's memory is not returned", () => {
  const db = makeDb();
  seed(db);
  const { rows } = searchMemories(db, { agentName: "ops", text: "kubernetes rollout status", limit: 5 });
  assert.equal(rows.length, 0);
});

test("the LIKE fallback still ranks by how many terms match", () => {
  const db = makeDb();
  seed(db);
  // Simulate a SQLite build without FTS5: exec of the virtual table throws.
  const noFts = { ...db, exec: (sql) => { if (/fts5/i.test(sql)) throw new Error("no such module: fts5"); return db.exec(sql); } };
  const { rows, engine } = searchMemories(noFts, { agentName: "ops", text: "postgres backups rotate", limit: 3 });
  assert.equal(engine, "like");
  assert.match(
    rows[0].content,
    /Postgres backups/,
    "three terms match this row; the newer rows match none of them"
  );
});

test("a query of only stopwords recalls nothing rather than everything", () => {
  const db = makeDb();
  seed(db);
  const { rows } = searchMemories(db, { agentName: "ops", text: "the and for with", limit: 5 });
  assert.equal(rows.length, 0);
});

test("match queries quote their terms so punctuation cannot break FTS syntax", () => {
  assert.equal(buildMatchQuery(extractTerms('restart "nginx" (please)')), '"restart" OR "nginx" OR "please"');
  assert.equal(buildMatchQuery(['bad"term']), '"badterm"');
});
