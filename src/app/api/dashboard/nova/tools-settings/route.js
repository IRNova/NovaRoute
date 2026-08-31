// Nova Tools & Integrations settings API.
// GET  → merged, secret-masked view of: media models, integrations creds,
//        MCP servers, security policy, channel status.
// POST → { scope: "media"|"integ"|"mcp"|"policy", patch } — empty-string
//        secret fields are ignored so existing values are never clobbered.
import { NextResponse } from "next/server";
import { makeKv } from "@/lib/db/helpers/kvStore.js";

export const dynamic = "force-dynamic";

const mediaKv = makeKv("novaMedia");
const integKv = makeKv("novaInteg");
const mcpKv = makeKv("novaMcp");
const toolsKv = makeKv("novaTools");
const chanKv = makeKv("channels");

function maskSecret(v) {
  const s = String(v || "");
  if (!s) return "";
  if (s.length <= 6) return "•••";
  return `••••${s.slice(-4)}`;
}

async function buildView() {
  const media = ((await mediaKv.get("defaults", {})) || {});
  const integGdrive = ((await integKv.get("gdrive", {})) || {});
  const integHa = ((await integKv.get("homeassistant", {})) || {});
  const integXai = ((await integKv.get("xai", {})) || {});
  const mcpServers = ((await mcpKv.get("servers", [])) || []);
  const policy = ((await toolsKv.get("policy", {})) || {});
  const discord = ((await chanKv.get("discord", null))) || {};
  const whatsapp = ((await chanKv.get("whatsapp-cloud", null))) || {};

  return {
    media: {
      visionModel: media.visionModel || "",
      imageModel: media.imageModel || "",
      ttsModel: media.ttsModel || "",
      sttModel: media.sttModel || "",
      voice: media.voice || "",
      voiceReply: !!media.voiceReply,
    },
    integ: {
      gdriveTokenMasked: maskSecret(integGdrive.accessToken),
      hasGdrive: !!integGdrive.accessToken,
      haUrl: integHa.url || "",
      haTokenMasked: maskSecret(integHa.token),
      hasHa: !!(integHa.url && integHa.token),
      xaiKeyMasked: maskSecret(integXai.apiKey),
      hasXai: !!integXai.apiKey,
    },
    mcp: {
      servers: mcpServers.map((s) => ({
        name: s.name,
        transport: s.transport,
        url: s.transport === "http" ? s.url : "",
        command: s.transport === "stdio" ? [s.command, ...(s.args || [])].join(" ") : "",
        hasOauth: !!s.oauth?.clientId,
        connected: !!s.oauth?.tokens?.access_token,
      })),
    },
    policy: {
      autoApproveReadOnly: policy.autoApproveReadOnly !== false,
      maxApprovalsPerHour: Number.isFinite(policy.maxApprovalsPerHour) ? policy.maxApprovalsPerHour : 20,
    },
    channels: {
      discordEnabled: !!discord.enabled,
      whatsappEnabled: !!whatsapp.enabled,
    },
  };
}

export async function GET() {
  try {
    return NextResponse.json({ ok: true, view: await buildView() });
  } catch (error) {
    console.error("[api-err]", error?.stack || error);
    return NextResponse.json({ error: error?.message || "failed" }, { status: 500 });
  }
}

function keepIfProvided(current, next, key) {
  const v = next[key];
  if (typeof v !== "string") return current;
  if (v.trim() === "" || v.startsWith("••")) return current; // masked/empty → keep
  return v;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { scope, patch = {} } = body || {};

    if (scope === "media") {
      const cur = ((await mediaKv.get("defaults", {})) || {});
      const next = { ...cur };
      for (const k of ["visionModel", "imageModel", "ttsModel", "sttModel", "voice"]) {
        if (typeof patch[k] === "string" && patch[k].trim() !== "") next[k] = patch[k].trim();
      }
      if (typeof patch.voiceReply === "boolean") next.voiceReply = patch.voiceReply;
      await mediaKv.set("defaults", next);
      return NextResponse.json({ ok: true });
    }

    if (scope === "integ") {
      if (patch.gdriveAccessToken && !String(patch.gdriveAccessToken).startsWith("••")) {
        const cur = ((await integKv.get("gdrive", {})) || {});
        cur.accessToken = String(patch.gdriveAccessToken).trim();
        await integKv.set("gdrive", cur);
      }
      if (patch.haUrl !== undefined || patch.haToken && !String(patch.haToken).startsWith("••")) {
        const cur = ((await integKv.get("homeassistant", {})) || {});
        if (typeof patch.haUrl === "string" && patch.haUrl.trim() !== "") cur.url = patch.haUrl.trim();
        if (patch.haToken && !String(patch.haToken).startsWith("••")) cur.token = String(patch.haToken).trim();
        await integKv.set("homeassistant", cur);
      }
      if (patch.xaiApiKey && !String(patch.xaiApiKey).startsWith("••")) {
        await integKv.set("xai", { apiKey: String(patch.xaiApiKey).trim() });
      }
      return NextResponse.json({ ok: true });
    }

    if (scope === "mcp") {
      const servers = ((await mcpKv.get("servers", [])) || []);
      if (patch.action === "add") {
        const name = String(patch.server?.name || "").trim().slice(0, 40);
        if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
        const idx = servers.findIndex((s) => s.name === name);
        const entry = idx >= 0 ? servers[idx] : { name };
        entry.transport = patch.server.transport === "http" ? "http" : "stdio";
        if (entry.transport === "http") {
          entry.url = String(patch.server.url || "").trim();
          delete entry.command; delete entry.args;
        } else {
          const parts = String(patch.server.command || "").trim().split(/\s+/);
          entry.command = parts[0] || "";
          entry.args = parts.slice(1);
          delete entry.url;
        }
        if (idx >= 0) servers[idx] = entry; else servers.push(entry);
      } else if (patch.action === "remove") {
        const i = servers.findIndex((s) => s.name === String(patch.name));
        if (i >= 0) servers.splice(i, 1);
      } else if (patch.action === "save_oauth") {
        const i = servers.findIndex((s) => s.name === String(patch.name));
        if (i >= 0) {
          const oa = servers[i].oauth || {};
          if (patch.oauth.clientId) oa.clientId = String(patch.oauth.clientId).trim();
          if (patch.oauth.clientSecret && !String(patch.oauth.clientSecret).startsWith("••")) oa.clientSecret = String(patch.oauth.clientSecret).trim();
          if (patch.oauth.authUrl) oa.authUrl = String(patch.oauth.authUrl).trim();
          if (patch.oauth.tokenUrl) oa.tokenUrl = String(patch.oauth.tokenUrl).trim();
          if (patch.oauth.scopes !== undefined) oa.scopes = String(patch.oauth.scopes).trim();
          servers[i].oauth = oa;
        }
      }
      await mcpKv.set("servers", servers.slice(0, 20));
      return NextResponse.json({ ok: true });
    }

    if (scope === "policy") {
      const cur = ((await toolsKv.get("policy", {})) || {});
      if (typeof patch.autoApproveReadOnly === "boolean") cur.autoApproveReadOnly = patch.autoApproveReadOnly;
      if (Number.isFinite(Number(patch.maxApprovalsPerHour))) cur.maxApprovalsPerHour = Math.max(1, Math.min(200, Number(patch.maxApprovalsPerHour)));
      await toolsKv.set("policy", cur);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "unknown scope" }, { status: 400 });
  } catch (error) {
    console.error("[api-err]", error?.stack || error);
    return NextResponse.json({ error: error?.message || "failed" }, { status: 500 });
  }
}
