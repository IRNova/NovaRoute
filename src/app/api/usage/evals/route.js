import { placeholderRead } from "@/lib/api/placeholder.js";

export async function GET() {
  return placeholderRead({ suites: [] });
}
