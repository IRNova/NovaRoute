import { placeholderRead, placeholderWrite } from "@/lib/api/placeholder.js";

export async function GET() {
  return placeholderRead({
    data: {
      envVars: [],
      nodeOptions: {},
      featureFlags: [],
    },
  });
}

export async function PATCH() {
  return placeholderWrite("Runtime environment editing");
}
