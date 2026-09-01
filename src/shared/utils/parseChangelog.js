// Turn the shipped CHANGELOG.md into entries the changelog page can render.
//
// /api/changelog serves markdown (text/markdown), and the page called .json()
// on it, so the parse always threw and the page always fell back to a
// hardcoded SAMPLE_CHANGELOG. Every operator who opened Changelog saw invented
// entries instead of the notes for the build they were running.
//
// Format produced by the file:
//   # v1.1.0 (2026-09-01)
//   ## Features
//   - **Area**: text that may
//     continue on the next line
//   ## Fixes
//   ...

const SECTION_TYPES = {
  feature: "feature",
  features: "feature",
  added: "feature",
  fix: "fix",
  fixes: "fix",
  fixed: "fix",
  security: "security",
  breaking: "breaking",
  internal: "internal",
  changed: "improvement",
  improvements: "improvement",
};

/**
 * @param {string} markdown raw CHANGELOG.md
 * @returns {Array<{version: string, date: string, changes: Array<{type: string, text: string}>}>}
 */
export function parseChangelog(markdown) {
  if (typeof markdown !== "string" || !markdown.trim()) return [];

  const entries = [];
  let entry = null;
  let type = "feature";
  let pending = null;

  const flush = () => {
    if (entry && pending && pending.text.trim()) entry.changes.push(pending);
    pending = null;
  };

  for (const rawLine of markdown.split("\n")) {
    const line = rawLine.replace(/\s+$/, "");

    const release = /^#\s+v?([0-9][0-9A-Za-z.+-]*)\s*(?:\(([^)]*)\))?/.exec(line);
    if (release) {
      flush();
      entry = { version: release[1], date: release[2] || "", changes: [] };
      entries.push(entry);
      type = "feature";
      continue;
    }

    const section = /^##\s+(.+?)\s*$/.exec(line);
    if (section) {
      flush();
      type = SECTION_TYPES[section[1].trim().toLowerCase()] || "improvement";
      continue;
    }

    if (!entry) continue;

    const bullet = /^[-*]\s+(.*)$/.exec(line);
    if (bullet) {
      flush();
      pending = { type, text: cleanup(bullet[1]) };
      continue;
    }

    // A wrapped continuation of the bullet above it.
    if (pending && /^\s+\S/.test(rawLine)) {
      pending.text = `${pending.text} ${cleanup(line.trim())}`.replace(/\s+/g, " ");
    }
  }
  flush();

  return entries;
}

// Markdown emphasis reads as literal asterisks once it is placed in a text
// node, so strip the markers and keep the words.
function cleanup(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .trim();
}
