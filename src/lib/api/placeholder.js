import { NextResponse } from "next/server";

// Several dashboard surfaces are wired to endpoints that were never finished.
// A GET returning an empty list is honest; a PATCH/POST answering
// `{ success: true }` without storing anything is not — the toggle animates,
// the user believes the setting is saved, and it silently reverts on reload.
//
// These helpers keep the empty reads and make the writes say what is true.

/** Empty-but-valid read for a surface that has no backend yet. */
export function placeholderRead(payload) {
  return NextResponse.json({ ...payload, implemented: false });
}

/** Write to a surface that has no backend yet: refuse instead of pretending. */
export function placeholderWrite(feature) {
  return NextResponse.json(
    {
      error: `${feature} is not implemented yet — this setting is not stored.`,
      implemented: false,
    },
    { status: 501 }
  );
}
