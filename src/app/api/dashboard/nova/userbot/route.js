import { NextResponse } from "next/server";
import { requireManagementAuth } from "@/lib/requireManagementAuth";
import {
  getStatus, saveConfig, saveCredentials,
  hasSecurityKey, verifySecurityKey, setSecurityKey,
  loginSendCode, loginSignIn, loginPassword,
  logoutUserbot, setUserActiveSince, ensureUserbot, isRunning,
  listKb, upsertKb, deleteKb,
  listDrafts, listContacts, editSentMessage, resolveUserbotDraft, runBacklogScan,
  listMemories, deleteMemory, clearMemories, resetUserbot, cleanupBotCards,
} from "@/lib/nova/userbot.js";

export const dynamic = "force-dynamic";

async function gate(request) {
  const rejection = await requireManagementAuth(request);
  if (rejection) return { rejection };
  return {};
}

function deny(res, status) {
  return NextResponse.json({ error: res }, { status });
}

// GET — status; masked config only.
export async function GET(request) {
  const g = await gate(request);
  if (g.rejection) return g.rejection;
  try {
    const status = await getStatus();
    status.securityKeySet = !g.keyMissing;
    status.securityKeyRequired = true;
    return NextResponse.json(status);
  } catch (error) {
    console.error("[api-err]", error?.stack || error);
    return NextResponse.json({ error: error?.message || "Failed to load userbot status" }, { status: 500 });
  }
}

// PUT — settings patch or credentials via body.kind.
export async function PUT(request) {
  const g = await gate(request);
  if (g.rejection) return g.rejection;
  let body = {};
  try { body = await request.json(); } catch {}
  try {
    if (body.kind === "credentials") {
      return NextResponse.json({ config: await saveCredentials({ apiId: body.apiId, apiHash: body.apiHash }) });
    }
    const config = await saveConfig(body);
    return NextResponse.json({ config });
  } catch (error) {
    console.error("[api-err]", error?.stack || error);
    return NextResponse.json({ error: error?.message || "Failed to save" }, { status: 500 });
  }
}

// POST — actions: set-key / send-code / sign-in / sign-in-password /
// logout / activate-now / connect / kb-add / kb-delete /
// draft-list / contacts-list / draft-resolve / msg-edit
export async function POST(request) {
  const g = await gate(request);
  if (g.rejection) return g.rejection;
  let body = {};
  try { body = await request.json(); } catch {}
  const action = String(body.action || "");

  try {
    switch (action) {
      case "send-code":
        return NextResponse.json(await loginSendCode(String(body.phoneNumber || "")));
      case "sign-in":
        return NextResponse.json(await loginSignIn(String(body.code || "")));
      case "sign-in-password":
        return NextResponse.json(await loginPassword(String(body.password || "")));
      case "logout":
        await logoutUserbot();
        return NextResponse.json({ ok: true });
      case "reset":
        return NextResponse.json({ ok: await resetUserbot() });
      case "bot-cleanup": {
        const r = await cleanupBotCards();
        return NextResponse.json(r);
      }
      case "activate-now":
        return NextResponse.json({ activeSince: await setUserActiveSince() });
      case "connect": {
        const ok = await ensureUserbot().catch((e) => { throw new Error(e?.message || "connect failed"); });
        return NextResponse.json({ ok, running: isRunning() });
      }
      case "kb-list":
        return NextResponse.json({ kb: await listKb() });
      case "kb-add":
        return NextResponse.json({ kb: await upsertKb({ id: body.id, kind: body.kind, q: body.q, a: body.a, title: body.title, content: body.content, pinned: body.pinned }) });
      case "kb-delete":
        return NextResponse.json({ kb: await deleteKb(String(body.id || "")) });
      case "draft-list":
        return NextResponse.json({ drafts: await listDrafts() });
      case "contacts-list":
        return NextResponse.json({ contacts: await listContacts() });
      case "draft-resolve":
        return NextResponse.json({ result: await resolveUserbotDraft(String(body.id || ""), body.approve ? "ok" : "no", body.text) });
      case "msg-edit":
        return NextResponse.json({ ok: await editSentMessage({ chatId: String(body.chatId || ""), tgId: String(body.tgId || ""), text: body.text }) });
      case "backlog-scan":
        return NextResponse.json(await runBacklogScan());
      case "memory-list":
        return NextResponse.json({ memories: await listMemories() });
      case "memory-delete":
        return NextResponse.json({ count: await deleteMemory(String(body.id || "")) });
      case "memory-clear":
        return NextResponse.json({ count: await clearMemories() });
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    console.error(`[userbot] action "${action}" failed:`, error?.stack || error?.message || error);
    return NextResponse.json({ error: error?.message || "Action failed" }, { status: 500 });
  }
}
