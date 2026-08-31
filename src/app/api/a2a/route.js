import { placeholderRead, placeholderWrite } from "@/lib/api/placeholder.js";

// Placeholder surface for the A2A agent registry UI. Returns an empty registry;
// mutations are acknowledged so the UI can manage its optimistic local state.
export async function GET() {
  return placeholderRead({ agents: [] });
}

export async function POST() {
  return placeholderWrite("A2A agent registry");
}
