import { placeholderWrite } from "@/lib/api/placeholder.js";

export async function POST() {
  return placeholderWrite("Evaluation suites");
}
