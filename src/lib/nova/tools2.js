// Nova Bot — extended agent tools glue: media, kanban, MCP.
// Tool names exposed to models: vision, image_gen, tts, transcribe,
// kanban, mcp_list, mcp_call. Also upgrades files tool with binary-doc
// extraction ("extract" action) and unified-diff edits ("diff" param).

import * as media from "./media.js";
import { addCard, listCards, moveCard, updateCardNotes, deleteCard, renderBoard } from "./kanban.js";
import { listServerTools, callServerTool } from "./mcp.js";
import { extractAny } from "./extract.js";

export function buildMiscToolDefinitions(agent) {
  const has = (t) => String(agent?.tools || "").split(",").map((x) => x.trim()).includes(t);
  const defs = [];

  if (has("vision")) {
    defs.push({
      type: "function",
      function: {
        name: "vision",
        description: "Ask questions about an image using a multimodal model. Provide either image_url (http) or image_path (server file).",
        parameters: {
          type: "object",
          properties: {
            image_url: { type: "string", description: "Public http(s) image URL" },
            image_path: { type: "string", description: "Local file path on server" },
            prompt: { type: "string", description: "What to do with the image" },
          },
        },
      },
    });
  }
  if (has("image_gen")) {
    defs.push({
      type: "function",
      function: {
        name: "image_gen",
        description: "Generate an image from a text prompt via the gateway's configured image provider. Returns a saved file path or URL.",
        parameters: {
          type: "object",
          properties: {
            prompt: { type: "string" },
            size: { type: "string", description: "e.g. 1024x1024" },
          },
          required: ["prompt"],
        },
      },
    });
  }
  if (has("tts")) {
    defs.push({
      type: "function",
      function: {
        name: "tts",
        description: "Convert text to spoken audio (mp3 saved on server; path returned). Persian and English supported depending on provider voice.",
        parameters: {
          type: "object",
          properties: {
            text: { type: "string" },
            voice: { type: "string", description: "Provider voice id, e.g. alloy" },
          },
          required: ["text"],
        },
      },
    });
  }
  if (has("transcribe")) {
    defs.push({
      type: "function",
      function: {
        name: "transcribe",
        description: "Transcribe an audio/video file on the server to text (Whisper-compatible).",
        parameters: {
          type: "object",
          properties: {
            audio_path: { type: "string", description: "Path to mp3/wav/ogg/mp4 on the server" },
            language: { type: "string", description: "ISO hint e.g. fa, en" },
          },
          required: ["audio_path"],
        },
      },
    });
  }
  if (has("kanban")) {
    defs.push({
      type: "function",
      function: {
        name: "kanban",
        description: "Manage project boards with columns backlog/todo/doing/done. Actions: add (title+notes?), list (col?), move (id+to_col), note (id+notes), delete (id).",
        parameters: {
          type: "object",
          properties: {
            action: { type: "string", enum: ["add", "list", "move", "note", "delete"] },
            board: { type: "string" },
            title: { type: "string" },
            notes: { type: "string" },
            col: { type: "string", enum: ["backlog", "todo", "doing", "done"] },
            to_col: { type: "string", enum: ["backlog", "todo", "doing", "done"] },
            id: { type: "integer" },
          },
          required: ["action"],
        },
      },
    });
  }
  if (has("mcp")) {
    defs.push({
      type: "function",
      function: {
        name: "mcp_list",
        description: "List tools offered by a configured MCP server (external integrations).",
        parameters: {
          type: "object",
          properties: { server: { type: "string" } },
          required: ["server"],
        },
      },
    });
    defs.push({
      type: "function",
      function: {
        name: "mcp_call",
        description: "Invoke a tool on a configured MCP server.",
        parameters: {
          type: "object",
          properties: {
            server: { type: "string" },
            tool: { type: "string" },
            arguments: { type: "object", description: "Tool input arguments" },
          },
          required: ["server", "tool"],
        },
      },
    });
  }
  return defs;
}

export async function executeMiscToolCall(call, meta = {}) {
  const name = call?.function?.name;
  let args = {};
  try {
    args = JSON.parse(call?.function?.arguments || "{}");
  } catch {
    return "ERROR: invalid tool arguments.";
  }
  const has = (t) => String(meta.agent?.tools || "").split(",").map((x) => x.trim()).includes(t);

  try {
    if (name === "vision") {
      if (!has("vision")) return "ERROR: no vision access.";
      return await media.vision(args);
    }
    if (name === "image_gen") {
      if (!has("image_gen")) return "ERROR: no image_gen access.";
      return await media.imageGen(args);
    }
    if (name === "tts") {
      if (!has("tts")) return "ERROR: no tts access.";
      return await media.tts(args);
    }
    if (name === "transcribe") {
      if (!has("transcribe")) return "ERROR: no transcribe access.";
      return await media.transcribe(args);
    }
    if (name === "kanban") {
      if (!has("kanban")) return "ERROR: no kanban access.";
      const board = String(args.board || meta.kanbanBoard || "main");
      switch (String(args.action || "")) {
        case "add": {
          const r = await addCard(board, args.title || "(untitled)", args.notes, meta.sessionId);
          return `Card #${r.id} added to ${board}/todo.`;
        }
        case "list": return renderBoard(await listCards(board, args.col));
        case "move": return (await moveCard(args.id, String(args.to_col || ""), args.position)) ? `#${args.id} → ${args.to_col}` : "ERROR bad column";
        case "note": return (await updateCardNotes(args.id, args.notes)) ? `#${args.id} notes updated` : "ERROR";
        case "delete": return (await deleteCard(args.id)) ? `#${args.id} deleted` : "ERROR";
        default: return 'ERROR: unknown kanban action';
      }
    }
    if (name === "mcp_list") {
      if (!has("mcp")) return "ERROR: no mcp access.";
      const tools = await listServerTools(String(args.server));
      if (!tools.length) return "No tools on this server.";
      return tools.map((t) => `- ${t.name}: ${t.description}`).join("\n").slice(0, 6000);
    }
    if (name === "mcp_call") {
      if (!has("mcp")) return "ERROR: no mcp access.";
      return await callServerTool(String(args.server), String(args.tool), args.arguments);
    }
    return null; // not ours
  } catch (e) {
    return `ERROR: ${String(e?.message || e).slice(0, 400)}`;
  }
}

/** Binary document read used by files.read fallback. */
export async function extractDocument(filePath) {
  return extractAny(filePath);
}
