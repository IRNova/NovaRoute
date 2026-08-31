import { NextResponse } from "next/server";
import { spawnSync } from "child_process";

const CLI_COMMANDS = {
  kiro: "kiro",
  cursor: "cursor",
  codex: "codex",
  cline: "cline",
  opencode: "opencode",
  commandcode: "commandcode",
  "gemini-cli": "gemini",
  "antigravity-cli": "antigravity",
  "grok-cli": "grok",
  "devin-cli": "devin",
  "devin-cli-agentic": "devin",
};

// Bare binary names only — no paths, no separators, no shell metacharacters.
const SAFE_CLI_NAME = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/;

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const cli = searchParams.get("cli");

    if (!cli) {
      return NextResponse.json({ error: "CLI name required" }, { status: 400 });
    }

    const command = CLI_COMMANDS[cli] || cli;
    if (!SAFE_CLI_NAME.test(command)) {
      return NextResponse.json({ installed: false, path: "", error: "Invalid CLI name" }, { status: 400 });
    }

    const isWindows = process.platform === "win32";
    const whichCmd = isWindows ? "where" : "which";

    try {
      // argv-based lookup (no shell) so the value can never be interpreted as a command.
      const result = spawnSync(whichCmd, [command], {
        encoding: "utf8",
        timeout: 5000,
        stdio: ["pipe", "pipe", "pipe"],
        shell: false,
      });
      if (result.status !== 0 || !result.stdout || !result.stdout.trim()) {
        return NextResponse.json({ installed: false, path: "" });
      }

      return NextResponse.json({
        installed: true,
        path: result.stdout.trim().split(isWindows ? /\r?\n/ : "\n")[0],
      });
    } catch {
      return NextResponse.json({
        installed: false,
        path: "",
      });
    }
  } catch (error) {
    return NextResponse.json({
      installed: false,
      path: "",
      error: error.message,
    });
  }
}
