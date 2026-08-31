import { NextResponse } from "next/server";
import {
  isLoginSupported,
  loginSessionActive,
  readScreen,
  startLogin,
  sendInput,
  sendKey,
  stopLogin,
} from "@/lib/cliLogin";

/**
 * GET /api/providers/[id]/cli-login — support flag + live tmux screen capture.
 * POST /api/providers/[id]/cli-login — { action: "start" | "input" | "key" | "stop", text?, key? }
 */
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    if (!isLoginSupported(id)) {
      return NextResponse.json({ supported: false });
    }
    const active = await loginSessionActive(id);
    const screen = active ? await readScreen(id) : { active: false, screen: "" };
    return NextResponse.json({ supported: true, active, screen: screen.screen });
  } catch (error) {
    console.log("Error reading CLI login status:", error);
    return NextResponse.json({ error: "Failed to read login status" }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    if (!isLoginSupported(id)) {
      return NextResponse.json({ ok: false, error: "Interactive login is not available for this provider" }, { status: 400 });
    }
    const body = await request.json().catch(() => ({}));
    switch (body.action) {
      case "start":
        return NextResponse.json(await startLogin(id));
      case "input": {
        if (!body.text || typeof body.text !== "string" || body.text.length > 2000) {
          return NextResponse.json({ ok: false, error: "Invalid input" }, { status: 400 });
        }
        return NextResponse.json(await sendInput(id, body.text));
      }
      case "key":
        return NextResponse.json(await sendKey(id, String(body.key || "")));
      case "stop":
        return NextResponse.json(await stopLogin(id));
      default:
        return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    console.log("Error running CLI login action:", error);
    return NextResponse.json({ ok: false, error: String(error?.message || error) }, { status: 500 });
  }
}
