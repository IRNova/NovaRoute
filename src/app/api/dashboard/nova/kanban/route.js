// Nova Bot Kanban API — board CRUD for the dashboard panel.
import { NextResponse } from "next/server";
import { addCard, listCards, moveCard, updateCardNotes, deleteCard } from "@/lib/nova/kanban.js";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const board = url.searchParams.get("board") || "main";
    const cards = await listCards(board);
    return NextResponse.json({ ok: true, cards });
  } catch (error) {
    console.error("[api-err]", error?.stack || error);
    return NextResponse.json({ error: error?.message || "failed" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    switch (String(body?.action || "")) {
      case "add": {
        const r = await addCard(String(body.board || "main"), String(body.title || "").slice(0, 300), body.notes ? String(body.notes).slice(0, 2000) : null);
        return NextResponse.json({ ok: true, id: r.id });
      }
      case "move": {
        await moveCard(Number(body.id), String(body.to_col), body.position);
        return NextResponse.json({ ok: true });
      }
      case "note": {
        await updateCardNotes(Number(body.id), String(body.notes || ""));
        return NextResponse.json({ ok: true });
      }
      case "delete": {
        await deleteCard(Number(body.id));
        return NextResponse.json({ ok: true });
      }
      default:
        return NextResponse.json({ error: "unknown action" }, { status: 400 });
    }
  } catch (error) {
    console.error("[api-err]", error?.stack || error);
    return NextResponse.json({ error: error?.message || "failed" }, { status: 500 });
  }
}
