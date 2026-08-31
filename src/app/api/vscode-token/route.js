import { placeholderRead, placeholderWrite } from "@/lib/api/placeholder.js";

export async function GET() {
  return placeholderRead({ enabled: false, token: "" });
}

export async function PATCH() {
  return placeholderWrite("VS Code token");
}

export async function POST() {
  return placeholderWrite("VS Code token");
}
