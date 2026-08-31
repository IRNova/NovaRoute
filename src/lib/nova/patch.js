// Nova Bot — unified diff patch parser & applier (Hermes patch_parser style).
// Supports standard git-style unified diffs with @@ hunks and context lines.

/**
 * Apply a unified diff to content. Returns { ok, result|error }.
 * Tolerates small context drift by fuzzy-matching hunk context (±2 lines).
 */
export function applyUnifiedDiff(content, diff) {
  const lines = String(content).split("\n");
  const diffLines = String(diff || "").split("\n");

  // Parse hunks: @@ -start,count +start,count @@
  const hunks = [];
  let cur = null;
  for (const line of diffLines) {
    const m = line.match(/^@@\s*-(\d+)(?:,(\d+))?\s*\+(\d+)(?:,(\d+))?\s*@@/);
    if (m) {
      cur = { oldStart: parseInt(m[1], 10), ops: [] };
      hunks.push(cur);
      continue;
    }
    if (!cur) continue;
    if (line.startsWith("---") || line.startsWith("+++") || line.startsWith("diff ") || line.startsWith("index ")) continue;
    if (line.startsWith("+")) cur.ops.push({ type: "add", text: line.slice(1) });
    else if (line.startsWith("-")) cur.ops.push({ type: "del", text: line.slice(1) });
    else if (line.startsWith(" ")) cur.ops.push({ type: "ctx", text: line.slice(1) });
    else if (line.trim() === "") cur.ops.push({ type: "ctx", text: "" });
  }

  if (!hunks.length) return { ok: false, error: "no valid @@ hunks found in diff" };

  // Apply bottom-up so earlier offsets stay valid.
  let working = [...lines];
  for (const hunk of hunks.reverse()) {
    const expected = hunk.ops.filter((o) => o.type !== "add").map((o) => o.text);
    const start = Math.max(0, hunk.oldStart - 1);

    let at = findMatch(working, expected, start);
    if (at === -1) at = findMatch(working, expected, 0); // full-file fallback
    if (at === -1) return { ok: false, error: `hunk context not found near line ${hunk.oldStart}` };

    const replacement = [];
    let e = 0;
    for (const op of hunk.ops) {
      if (op.type === "del") { e++; continue; }
      replacement.push(op.text);
      if (op.type === "ctx") e++;
    }
    working.splice(at, e, ...replacement);
  }
  return { ok: true, result: working.join("\n") };
}

function findMatch(haystack, needles, from) {
  if (!needles.length) return -1;
  outer: for (let i = Math.max(0, from - 2); i <= haystack.length - needles.length; i++) {
    for (let j = 0; j < needles.length; j++) {
      const tolerance = j === 0 || j === needles.length - 1 ? 0 : 0; // strict
      if ((haystack[i + j] ?? "").trimEnd() !== needles[j].trimEnd()) {
        if (tolerance === 0) continue outer;
      }
    }
    return i;
  }
  // Fuzzy second pass: ignore blank ctx mismatches.
  outer2: for (let i = Math.max(0, from - 2); i <= haystack.length - needles.length; i++) {
    let offset = 0;
    for (let j = 0; j < needles.length; j++) {
      const hay = (haystack[i + offset] ?? "").trimEnd();
      const ned = needles[j].trimEnd();
      if (ned !== hay && !(ned === "" )) continue outer2;
      offset++;
    }
    return i;
  }
  return -1;
}
