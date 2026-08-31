import { placeholderRead, placeholderWrite } from "@/lib/api/placeholder.js";

export async function GET() {
  return placeholderRead({ budgets: [] });
}

export async function POST() {
  return placeholderWrite("Spend budgets");
}

export async function DELETE() {
  return placeholderWrite("Spend budgets");
}
