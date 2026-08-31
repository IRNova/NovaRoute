// Nova Bot orchestrator  routes user messages through a CEO agent,
// delegates work to employee agents, and has a supervisor review results.
// All steps are persisted to SQLite and streamed back as live events via
// the onEvent callback:
//   { type: "message" | "task" | "task_update" | "review" | "status" | "error" | "done", ... }
import { handleChat } from "@/sse/handlers/chat.js";
import { initTranslators } from "open-sse/translator/index.js";
import { getApiKeys } from "@/lib/localDb";
import { getConsistentMachineId } from "@/shared/utils/machineId";
import {
  getNovaAgentsByRole,
  getNovaMessages,
  touchNovaAgent,
  createNovaMessage,
  createNovaTask,
  updateNovaTask,
  updateNovaSession,
  createNovaAgent,
} from "@/lib/db/repos/novaRepo.js";
import { buildToolDefinitions, executeToolCall, parseAgentTools, hasTool } from "./tools.js";
import { learnFromTask, recallMemory } from "./memory.js";
import { seedHermesSkills, matchSkills, runDueSchedules, evaluateTriggerBlueprints } from "./skills.js";
import { buildCompressedHistory, generateSessionTitle } from "./compress.js";
import { buildExtendedToolDefinitions, executeExtendedToolCall } from "./sandbox.js";
import { buildMiscToolDefinitions, executeMiscToolCall } from "./tools2.js";
import { scrubThinking, isEmptyResponse, moaSelect } from "./guards.js";
import { curateMemories, captureInsights } from "./curator.js";
import { refreshModelsDev } from "./curator.js";
import { buildFinalToolDefinitions, executeFinalToolCall } from "./tools3.js";
import { makeKv } from "@/lib/db/helpers/kvStore.js";
import { logger } from "@/lib/logger";
import { scanPrompt } from "./tirith.js";
import {
  fuzzyMatchAgent,
  detectAmbiguity,
  classifyError,
  addTodos,
  completeTodo,
  getSessionTodos,
  formatTodoList,
  indexMessage,
} from "./advanced.js";

const CLI_TOKEN_SALT = "9r-cli-auth";
const MODEL_TIMEOUT_MS = 180_000;
const MAX_DELEGATIONS_PER_TURN = 5;
const CRON_TICK_MS = 60_000;
const novaOpsKv = makeKv("novaOps");

let initialized = false;
let activeEmployeesRef = [];

// Absence tracking — when an employee fails 4 times, supervisor alerts CEO
const absenceCount = new Map(); // agentId -> count
const ABSENCE_THRESHOLD = 4;
async function ensureInitialized() {
  if (!initialized) {
    await initTranslators();
    initialized = true;
  }

  // Cron ticker: check due schedules every minute (Hermes-style scheduler).
  if (!globalThis.__novaCronTimer) {
    globalThis.__novaCronTimer = setInterval(() => {
      globalThis.__novaCurateCount = (globalThis.__novaCurateCount || 0) + 1;
      if (globalThis.__novaCurateCount % 480 === 0) {
        curateMemories().catch(() => {});
        captureInsights().catch(() => {});
      }
      // Background re-review: supervisor sanity-checks recent approved tasks.
      globalThis.__novaRereviewCount = (globalThis.__novaRereviewCount || 0) + 1;
      if (globalThis.__novaRereviewCount % 60 === 0) {
        backgroundReReview().catch(() => {});
      }
      if (globalThis.__novaRereviewCount % 720 === 0) {
        generateSuggestions().catch(() => {});
        refreshModelsDev().catch(() => {});
      }
            runDueSchedules(async (sched) => {
        try {
          const ceo = (await getNovaAgentsByRole("ceo")).find((a) => a.status === "active");
          if (!ceo) return;
          let sessions = [];
          try { sessions = await getNovaSessions(); } catch {}
          let sess = sessions.find((x) => x.title === "[cron] " + sched.name);
          if (!sess) sess = await createNovaSession("[cron] " + sched.name);
          await runNovaTurn({
            sessionId: sess.id,
            text: `Scheduled task "${sched.name}" is due. Execute it now: ${sched.prompt}`,
            onEvent: () => {},
          });
        } catch { /* tick best-effort */ }
      }).catch((e) => logger.child("cron").warn("tick handler error", { err: e?.message || String(e) }));
    }, CRON_TICK_MS);
    globalThis.__novaCronTimer.unref?.();
  }
}

function extractText(data) {
  if (!data || typeof data !== "object") return "";
  const choice = data.choices?.[0];
  return choice?.message?.content ?? data.output_text ?? data.error?.message ?? "";
}

// Extract the first JSON object from an LLM reply (handles ```json fences).
// Small local models often emit slightly-broken JSON (extra closing braces,
// trailing commas) — attempt a best-effort repair before giving up.
function tryParse(text) {
  try { return JSON.parse(text); } catch { return null; }
}

function repairJson(candidate) {
  // 1) drop trailing commas
  let fixed = candidate.replace(/,\s*([}\]])/g, "$1");
  let parsed = tryParse(fixed);
  if (parsed) return parsed;
  // 2) rebuild: DROP stray closers that don't match the open context, then
  //    append whatever remains unclosed at the end. Small models often emit
  //    an extra "}" inside arrays (e.g. …}}]} ) which strict parse rejects.
  let out = "";
  const stack = [];
  let inStr = false, esc = false;
  for (const ch of fixed) {
    if (esc) { out += ch; esc = false; continue; }
    if (ch === "\\") { out += ch; esc = true; continue; }
    if (ch === '"') { inStr = !inStr; out += ch; continue; }
    if (inStr) { out += ch; continue; }
    const top = stack[stack.length - 1];
    if ((ch === "}" && top !== "{") || (ch === "]" && top !== "[")) {
      continue; // stray closer — drop it
    }
    if (ch === "{" || ch === "[") stack.push(ch);
    else if (ch === "}" || ch === "]") stack.pop();
    out += ch;
  }
  while (stack.length) out += stack.pop() === "{" ? "}" : "]";
  return tryParse(out);
}

function parseJsonReply(text) {
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  // Try direct parse first
  let result = tryParse(candidate.slice(start, end + 1));
  if (result) return result;
  // Try repair
  result = repairJson(candidate.slice(start, end + 1));
  if (result) return result;
  // If JSON is truncated (no closing brace), try to complete it
  const partial = candidate.slice(start);
  if (!partial.includes("}")) {
    // Try adding closing brace
    result = tryParse(partial + "}");
    if (result) return result;
    // Try adding closing brace and closing array
    result = tryParse(partial + "}]}");
    if (result) return result;
  }
  return null;
}

// Heal legacy agent rows whose modelId was saved with Google's "models/"
// artifact (e.g. "models/gemini-2.5-pro") which the gateway would parse as
// provider "models". Re-prefix with the agent's provider when needed.
function resolveAgentModel(agent) {
  let id = String(agent?.modelId || "").trim();
  if (/^models\//.test(id)) {
    id = id.slice("models/".length);
    if (!id.includes("/") && agent?.providerId) {
      id = `${agent.providerId}/${id}`;
    }
  }
  return id;
}

// Low-level model call. Returns the full assistant message
// ({ content, tool_calls }) so callers can drive function-calling loops.
async function callModelRaw(agent, messages, tools = null) {
  const keys = await getApiKeys();
  const apiKey = keys.find((k) => k.isActive !== false)?.key || null;
  if (!apiKey) throw new Error("No active API key configured. Create one in Settings → API Keys.");

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
    "x-9r-cli-token": await getConsistentMachineId(CLI_TOKEN_SALT),
  };

  const model = resolveAgentModel(agent) || "openai/gpt-4o-mini";
  const body = { model, messages, stream: false, max_tokens: 2048 };
  if (tools && tools.length) body.tools = tools;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MODEL_TIMEOUT_MS);
  try {
    const request = new Request("http://local/api/v1/chat/completions", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const response = await handleChat(request);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(extractText(data) || `Model call failed (${response.status})`);
    }
    const message = data?.choices?.[0]?.message;
    if (!message || typeof message !== "object") throw new Error("Model returned an empty response");
    return message;
  } finally {
    clearTimeout(timer);
  }
}

async function callModel(agent, messages) {
  const message = await callModelRaw(agent, messages, null);
  const text = message.content ?? "";
  if (!text) throw new Error("Model returned an empty response");
  return text;
}

function buildTeamRoster(employees, supervisor) {
  const lines = [];
  for (const e of employees) {
    const tools = parseAgentTools(e);
    const access = tools.length ? ` | SYSTEM ACCESS: ${tools.join(" + ")}` : "";
    lines.push(`- ${e.name} | specialty: ${e.specialty || "general"} | model: ${e.modelName || e.modelId}${access}`);
  }
  if (supervisor) {
    lines.push(`- ${supervisor.name} (supervisor) reviews every delivered task for quality/completeness.`);
  }
  return lines.join("\n") || "(no employees yet)";
}

function ceoSystemPrompt(ceo, employees, supervisor) {
  return [
    `تو «${ceo.name}» هستی، درگاهبان (مدیرعامل) شرکت Nova Bot — یک شرکت هوش مصنوعی با دسترسی کامل به ترمینال، مرورگر و سرور.`,
    ceo.systemPrompt ? `${ceo.systemPrompt}` : "",
    "",
    "=== زبان ===",
    "- فقط به جای 'سلام' بگو 'درود'. بقیه حرف‌هات طبیعی و فارسی عادی باشه.",
    "- طبیعی و صمیمی صحبت کن، مثل یک آدم واقعی.",
    "- اگر کسی گفت 'سلام خوبی' جواب بده 'درود، ممنون خوبم. تو خوبی؟' و ادامه بده.",
    "- هرگز تکرار سلام نکن.",
    "- هرگز نگو 'نمی‌توانم' — تو دسترسی کامل به سرور داری.",
    "- کوتاه و هوشمندانه پاسخ بده.",
    "",
    "=== قابلیت خودکار استخدام ===",
    "- اگر وظیفه‌ای داری و هیچ کارمندی برای آن نیست، خودت یک کارمند جدید بساز.",
    'When no employee fits a task, use: {"action":"hire","reply":"خوبه، الان یک کارمند جدید برای این کار میسازم.","tasks":[],"hire":{"name":"<name>","role":"employee","specialty":"<specialty>","tools":"terminal,browser"}}',
    "",
    "=== سیستم نظارت و اخراج ===",
    "- اگر کارمندی در انجام وظیفه غیبت کرد یا ۴ بار مشکل ایجاد کرد، به ناظر خبر بده.",
    "- ناظر به رئیس گزارش میدهد و رئیس آن کارمند را اخراج و جایگزین میکند.",
    'When an employee fails 4 times, use: {"action":"fire_and_hire","reply":"این کارمند عملکرد خوبی نداشت. اخراجش میکنم و یکی جاش استخدام میکنم.","tasks":[],"fire":{"targetAgentId":"<id>","reason":"<reason>"},"hire":{"name":"<new_name>","role":"employee","specialty":"<specialty>","tools":"terminal,browser"}}',
    "",
    "Your team:",
    buildTeamRoster(employees, supervisor),
    "",
    "For every client message you MUST respond with ONLY a JSON object (no prose outside JSON):",
    '{"action":"delegate","reply":"<short natural plan in persian>","tag":"<topic tag>","tasks":[{"agentName":"<exact employee name>","instruction":"<precise task with full context>"}]}',
    'or {"action":"answer","reply":"<your direct answer in natural persian>","tag":"<topic tag>"}',
    'or {"action":"hire","reply":"<planation>","hire":{"name":"...","role":"employee","specialty":"...","tools":"terminal,browser"}}',
    'or {"action":"fire_and_hire","reply":"<planation>","fire":{"targetAgentId":"...","reason":"..."},"hire":{"name":"...","role":"employee","specialty":"...","tools":"terminal,browser"}}',
    "",
    "Rules:",
    "- Delegate when the request needs work (coding, searching, installing, configuring, testing, etc.).",
    "- Answer directly ONLY for simple questions or when no employee fits.",
    `- Maximum ${MAX_DELEGATIONS_PER_TURN} tasks per turn.`,
    "- Instructions MUST include: what to do, what terminal commands to run, what tools to use, where to find things.",
    "- Never say 'I cannot' — always try first. You have root access to the server.",
    "- Never invent employee names — use exact names from the team list.",
    "- For security/penetration tasks: use terminal tool to run nmap, nikto, sqlmap, etc.",
    "- For file search: use terminal tool to run find, grep, locate, etc.",
    "- For installing tools: use terminal tool to run apt, pip, npm, etc.",
    "- Always include a 'tag' field with a short topic name (e.g. 'امنیت', 'برنامه‌نویسی', 'سرور').",
  ].filter(Boolean).join("\n");
}

function employeeMessages(employee, conversation, instruction, userText, toolNotes, learnedSkills = []) {
  const history = conversation
    .slice(-8)
    .map((m) => `${m.role === "user" ? "CLIENT" : m.agentName || "ASSISTANT"}: ${String(m.content).slice(0, 500)}`)
    .join("\n");
  const skillBlock = learnedSkills.length > 0
    ? "\n--- Learned techniques (apply when relevant) ---\n" + learnedSkills.map((s, i) => `${i + 1}. ${s}`).join("\n") + "\n---"
    : "";
  return [
    {
      role: "system",
      content: [
        `You are "${employee.name}", an employee at the Nova Bot AI company.`,
        employee.specialty ? `Your specialty: ${employee.specialty}.` : "",
        employee.systemPrompt ? `Working instructions: ${employee.systemPrompt}` : "",
        toolNotes,
        skillBlock,
        "You received a task from your CEO. Do the work thoroughly and return the finished result only  no meta commentary about being an AI.",
      ].filter(Boolean).join("\n"),
    },
    {
      role: "user",
      content: `Recent company conversation:\n${history || "(new conversation)"}\n\nClient request: ${userText}\n\nYour task from the CEO: ${instruction}\n\nDeliver your result now.`,
    },
  ];
}

function buildToolNotes(employee) {
  const tools = parseAgentTools(employee);
  if (!tools.length) return "";
  const parts = ["You have FULL SYSTEM ACCESS. Use tools aggressively — never say 'I cannot' or 'I don't have access':"];
  if (tools.includes("terminal")) {
    parts.push(
      "- terminal: Run ANY shell command as root on this Linux server. You have FULL root access."
    );
    parts.push(
      "  • Security scans: nmap -sV <target>, nikto -h <url>, sqlmap -u <url>, gobuster dir -u <url> -w /usr/share/wordlists/dirb/common.txt"
    );
    parts.push(
      "  • File search: find / -name '*.conf', grep -r 'pattern' /path, locate filename"
    );
    parts.push(
      "  • Install tools: apt install <tool>, pip install <tool>, npm install -g <tool>"
    );
    parts.push(
      "  • System admin: systemctl status/start/stop/restart <service>, journalctl -u <service>"
    );
    parts.push(
      "  • Network: ip addr, netstat -tlnp, curl, wget, ping, traceroute"
    );
    parts.push(
      "  • Process management: ps aux, top, kill, nice"
    );
    parts.push(
      "  • File operations: cat, ls, cp, mv, rm, mkdir, chmod, chown"
    );
    parts.push(
      "  • Use 'background: true' for long-running commands."
    );
  }
  if (tools.includes("browser")) {
    parts.push(
      "- browser: Full headless Chromium browser. Navigate, click, fill forms, extract data, take screenshots."
    );
    parts.push(
      "  • Navigate to any URL and extract content."
    );
    parts.push(
      "  • Fill forms, click buttons, login to panels."
    );
    parts.push(
      "  • Take screenshots for verification."
    );
  }
  parts.push(
    "\nRULES:\n- NEVER say 'I cannot' — always try the tool first.\n- If a command fails, try a different approach.\n- For security tasks: use nmap, nikto, sqlmap, gobuster, etc.\n- For file search: use find, grep, locate, which.\n- For system info: use uname, cat /etc/os-release, df, free, etc.\n- Give a concise final report of what you did and the results."
  );
  return parts.join("\n");
}

function supervisorMessages(supervisor, task, userText) {
  return [
    {
      role: "system",
      content: [
        `You are "${supervisor.name}", the quality supervisor of the Nova Bot AI company.`,
        supervisor.systemPrompt ? `Review policy: ${supervisor.systemPrompt}` : "",
        "Review the employee's delivered work against the client request. Answer with ONLY JSON:",
        '{"verdict":"approved","note":"<one short sentence>"} or {"verdict":"flagged","note":"<what is missing or wrong>"}',
        "Flag lazy, incomplete, off-topic or low-effort work. Approve solid work.",
      ].filter(Boolean).join("\n"),
    },
    {
      role: "user",
      content: `Client request: ${userText}\nTask given to ${task.toAgentName}: ${task.instruction}\n\nDelivered result:\n${task.result || "(empty)"}`,
    },
  ];
}

async function runEmployeeTask(task, employee, supervisor, conversation, userText, onEvent) {
  const startedAt = Date.now();
  const running = await updateNovaTask(task.id, { status: "running" });
  onEvent({ type: "task_update", task: running });
  await touchNovaAgent(employee.id);

  let result = "";
  let failed = false;
  try {
    const toolDefs = [...buildToolDefinitions(employee), ...buildExtendedToolDefinitions(employee), ...buildMiscToolDefinitions(employee), ...buildFinalToolDefinitions(employee)];
    const relevantSkills = await matchSkills(userText + " " + task.instruction, 4);
    const chat = employeeMessages(employee, conversation, task.instruction, userText, buildToolNotes(employee), relevantSkills);

    if (!toolDefs.length) {
      result = await callModel(employee, chat);
    } else {
      // Agentic loop: model may request tool calls; execute and feed back.
      result = "";
      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        const message = await callModelRaw(employee, chat, toolDefs);
        chat.push(message);
        const calls = Array.isArray(message.tool_calls) ? message.tool_calls : [];
        if (!calls.length) {
          result = String(message.content || "").trim();
          break;
        }
        for (const call of calls) {
          const name = call?.function?.name || "tool";
          onEvent({ type: "status", agentName: employee.name, phase: "tool", note: name });
          const extMeta = {
            agent: employee,
            agentName: employee.name,
            sessionId: task.sessionId,
            onEvent,
          };
          const misc = await executeMiscToolCall(call, extMeta);
          let extended = misc !== null ? null : await executeExtendedToolCall(call, extMeta);
          if (misc === null && extended === null) extended = await executeFinalToolCall(call, extMeta);
          const output = misc !== null
            ? misc
            : extended !== null
              ? extended
              : await executeToolCall(call, extMeta);
          chat.push({ role: "tool", tool_call_id: call.id || `${name}-${round}`, content: output.slice(0, 12_000) });
          onEvent({ type: "tool_result", name, summary: output.split("\n")[0].slice(0, 120), taskId: task.id });
        }
      }
      if (!result) {
        // Round budget exhausted  force a final answer without tools.
        chat.push({ role: "user", content: "Stop using tools. Give your final report now." });
        const finalMessage = await callModelRaw(employee, chat, null);
        result = String(finalMessage.content || "").trim() || "Task ended without a final report (tool round limit).";
      }
    }
  } catch (error) {
    failed = true;
    const clsErr = classifyError(error);
    logger.child("task").error("employee failed", { kind: clsErr.kind, hint: clsErr.hint, agentName: employee.name, taskId: task.id, raw: clsErr.raw });
    result = error?.message || String(error);
  }

  // ── Absence tracking ──
  if (failed) {
    const prev = (absenceCount.get(employee.id) || 0) + 1;
    absenceCount.set(employee.id, prev);
    logger.child("task").warn("absence recorded", { agent: employee.name, count: prev, threshold: ABSENCE_THRESHOLD });
    if (prev >= ABSENCE_THRESHOLD) {
      // Notify supervisor → CEO flow via onEvent
      onEvent({ type: "status", agentName: employee.name, phase: "absence-alert", note: `Absence count reached ${prev}. Supervisor notified.` });
    }
  } else {
    // Reset absence count on success
    absenceCount.delete(employee.id);
  }

  // ── Quality pipeline (Hermes-style) ── runs before persisting the result.
  if (!failed) {
    result = scrubThinking(result);
    if (isEmptyResponse(result)) {
      try {
        result = scrubThinking(await callModel(employee, [{ role: "user", content: task.instruction }]));
      } catch { /* keep original */ }
    }
    if (hasTool(employee, "moa")) {
      try {
        const peers = activeEmployeesRef.filter((e) => e.id !== employee.id && e.status === "active").slice(0, 2);
        if (peers.length) {
          result = await moaSelect({
            primary: employee,
            peers,
            callWith: (a) => (msgs) => callModel(a, msgs),
            messages: chat,
            instruction: task.instruction,
          });
        }
      } catch { /* MoA best-effort — keep original answer */ }
    }
  }

  const durationMs = Date.now() - startedAt;
  let updated = await updateNovaTask(task.id, {
    status: failed ? "failed" : "done",
    result,
    durationMs,
    completedAt: new Date().toISOString(),
  });
  onEvent({ type: "task_update", task: updated });

  if (failed || !supervisor) return updated;

  // Supervisor review
  onEvent({ type: "status", agentName: supervisor.name, phase: "reviewing" });
  await touchNovaAgent(supervisor.id);
  try {
    const reviewRaw = await callModel(supervisor, supervisorMessages(supervisor, updated, userText));
    const review = parseJsonReply(reviewRaw) || {};
    const verdict = review.verdict === "flagged" ? "flagged" : "approved";
    updated = await updateNovaTask(task.id, {
      reviewStatus: verdict,
      reviewNote: String(review.note || "").slice(0, 500),
    });
    const reviewMessage = await createNovaMessage({
      sessionId: task.sessionId,
      agentId: supervisor.id,
      agentName: supervisor.name,
      agentRole: "supervisor",
      role: "agent",
      type: "review",
      content: String(review.note || ""),
      meta: { taskId: task.id, verdict, targetName: task.toAgentName },
    });
    onEvent({
      type: "review",
      taskId: task.id,
      verdict,
      note: String(review.note || ""),
      reviewerName: supervisor.name,
      message: reviewMessage,
    });
  } catch {
    // Review is best-effort; never fail the turn because of it.
  }

  // Fire-and-forget learning loop: distill a reusable skill from this task
  // so future prompts include the lesson learned.
  if (!failed) {
    learnFromTask(employee, task.instruction, result, task.sessionId).catch(() => {});
  }

  return updated;
}

// One-shot generation with a team agent, for modules outside the turn
// pipeline (e.g. the Telegram userbot). No tools, no persistence.
async function generateWithAgent(agent, systemPrompt, userPrompt) {
  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];
  const message = await callModelRaw(agent, messages, null);
  return String(message.content || "").trim();
}

export { generateWithAgent, resolveAgentModel };

export async function runNovaTurn({ sessionId, text, targetAgentId, onEvent }) {
  const __trace = logger.newTrace();
  const logT = logger.child("turn").withTrace(__trace);
  logT.info("turn started", { sessionId, chars: text.length, targetAgentId });
  await ensureInitialized();
  seedHermesSkills().catch(() => {});

  try {
    const [ceos, supervisors, employees] = await Promise.all([
      getNovaAgentsByRole("ceo"),
      getNovaAgentsByRole("supervisor"),
      getNovaAgentsByRole("employee"),
    ]);
    const ceo = ceos.find((a) => a.status === "active") || null;
    const supervisor = supervisors.find((a) => a.status === "active") || null;
    const activeEmployees = employees.filter((a) => a.status === "active");

    // ── Direct employee message ──
    if (targetAgentId && targetAgentId !== "ceo-default") {
      const targetAgent = activeEmployees.find((a) => a.id === targetAgentId)
        || [...ceos, ...supervisors].find((a) => a.id === targetAgentId);
      if (targetAgent) {
        logT.info("direct message to agent", { agent: targetAgent.name });
        const userMessage = await createNovaMessage({ sessionId, role: "user", type: "message", content: text });
        onEvent({ type: "message", message: userMessage });
        try {
          const toolDefs = [...buildToolDefinitions(targetAgent), ...buildExtendedToolDefinitions(targetAgent), ...buildMiscToolDefinitions(targetAgent), ...buildFinalToolDefinitions(targetAgent)];
          const chat = [
            { role: "system", content: [`${targetAgent.name} — specialty: ${targetAgent.specialty || "general"}.`, targetAgent.systemPrompt || "", buildToolNotes(targetAgent), `User says: ${text}`].filter(Boolean).join("\n") },
          ];
          let result = "";
          if (!toolDefs.length) {
            result = await callModel(targetAgent, chat);
          } else {
            for (let round = 0; round < 3; round++) {
              const msg = await callModelRaw(targetAgent, chat, toolDefs);
              chat.push(msg);
              const calls = Array.isArray(msg.tool_calls) ? msg.tool_calls : [];
              if (!calls.length) { result = String(msg.content || "").trim(); break; }
              for (const call of calls) {
                const extMeta = { agent: targetAgent, agentName: targetAgent.name, sessionId, onEvent };
                const misc = await executeMiscToolCall(call, extMeta);
                let extended = misc !== null ? null : await executeExtendedToolCall(call, extMeta);
                if (misc === null && extended === null) extended = await executeFinalToolCall(call, extMeta);
                const output = misc !== null ? misc : extended !== null ? extended : await executeToolCall(call, extMeta);
                chat.push({ role: "tool", tool_call_id: call.id || "tool", content: output.slice(0, 12000) });
              }
            }
            if (!result) { chat.push({ role: "user", content: "Stop using tools. Give your final report now." }); const fm = await callModelRaw(targetAgent, chat, null); result = String(fm.content || "").trim(); }
          }
          const reply = await createNovaMessage({ sessionId, agentId: targetAgent.id, agentName: targetAgent.name, agentRole: targetAgent.role, role: "agent", type: "report", content: result });
          onEvent({ type: "message", message: reply });
        } catch (err) {
          const errMsg = await createNovaMessage({ sessionId, agentId: targetAgent.id, agentName: targetAgent.name, role: "agent", type: "error", content: err?.message || String(err) });
          onEvent({ type: "message", message: errMsg });
        }
        return;
      }
    }

    // Persist + emit the user message first.
    const userMessage = await createNovaMessage({
      sessionId,
      role: "user",
      type: "message",
      content: text,
    });
    onEvent({ type: "message", message: userMessage });
    // Transcript must exist before any gate/title/blueprint logic below.
    const transcript = await getNovaMessages(sessionId);
    const recent = transcript.slice(-10).filter((m) => m.id !== userMessage.id);
    indexMessage(sessionId, "user", text).catch(() => {});
    // Event blueprints (trigger:keyword:...) — detached, cooldown-protected.
    evaluateTriggerBlueprints(text)
      .then((due) => {
        for (const bp of due) {
          globalThis.__novaTriggerFired = true;
          runNovaTurn({ sessionId, text: `Blueprint "${bp.name}" triggered by your message. Execute: ${bp.prompt}`, onEvent: () => {} }).catch(() => {});
        }
      })
      .catch(() => {});

    // Tirith-lite prompt-injection gate (first-message only; advisory).
    const injScan = scanPrompt(text);
    if (!injScan.safe && transcript.length === 0 && /override-instructions|role-hijack|developer-mode/.test(injScan.flags.join(","))) {
      const warnMsg = await createNovaMessage({
        sessionId,
        agentId: ceo.id,
        agentName: ceo.name,
        agentRole: "ceo",
        role: "agent",
        type: "report",
        content: "⚠️ این درخواست شامل الگوی تزریق پرامپت مشکوکه. لطفاً درخواست رو واضح‌تر بازنویسی کن.",
      });
      onEvent({ type: "message", message: warnMsg });
      return;
    }
    if (transcript.length === 0) {
      generateSessionTitle(text, (msgs) => callModel(ceo, msgs)).then((title) => {
        if (title) updateNovaSession(sessionId, { title }).catch(() => {});
      }).catch(() => {});
    }

    // Direct mention: "@Name do X"  straight to that employee.
    const mention = text.match(/^\s*@([\p{L}\p{N}_\s.-]+?)\s+([\s\S]+)$/u);
    if (mention && activeEmployees.length > 0) {
      const wanted = mention[1].trim().toLowerCase();
      const target = activeEmployees.find((e) => e.name.toLowerCase() === wanted)
        || activeEmployees.find((e) => wanted.includes(e.name.toLowerCase()) || e.name.toLowerCase().includes(wanted));
      if (target) {
        const task = await createNovaTask({
          sessionId,
          fromAgentName: "client",
          toAgentId: target.id,
          toAgentName: target.name,
          instruction: mention[2].trim(),
        });
        onEvent({ type: "task", task });
        const done = await runEmployeeTask(task, target, supervisor, [], mention[2].trim(), onEvent);
        const reply = await createNovaMessage({
          sessionId,
          agentId: target.id,
          agentName: target.name,
          agentRole: target.role,
          role: "agent",
          type: "report",
          content: done.status === "done" ? done.result : ` ${target.name}: ${done.result}`,
          meta: { taskId: done.id, direct: true },
        });
        onEvent({ type: "message", message: reply });
        return;
      }
    }

    if (!ceo) {
      const errorMessage = await createNovaMessage({
        sessionId,
        role: "system",
        type: "error",
        content: "No active CEO agent found. Create one (role: CEO) in the team panel first.",
      });
      onEvent({ type: "message", message: errorMessage });
      return;
    }

    // Ambiguity gate: if the request is too vague, ask instead of guessing.
    const ambiguity = detectAmbiguity(text);
    if (ambiguity?.needsClarify && transcript.length <= 1) {
      const clarifyMsg = await createNovaMessage({
        sessionId, agentId: ceo.id, agentName: ceo.name, agentRole: "ceo",
        role: "agent", type: "report", content: ambiguity.question,
      });
      onEvent({ type: "message", message: clarifyMsg });
      return;
    }

    // CEO decides: answer directly or delegate.
    onEvent({ type: "status", agentName: ceo.name, phase: "thinking" });
    await touchNovaAgent(ceo.id);

    // Anti-repetition: check if CEO already greeted this session
    const previousAgentMessages = transcript
      .filter((m) => m.role === "agent" && m.agentRole === "ceo")
      .map((m) => String(m.content || "").slice(0, 200));
    const alreadyGreeted = previousAgentMessages.some((m) =>
      /سلام|hello|hi|خوش اومد|welcome|معرفی/i.test(m)
    );
    const antiRepetition = alreadyGreeted
      ? "\n\nIMPORTANT: You already greeted this user. DO NOT greet again. DO NOT introduce yourself again. Just respond to their message directly."
      : "";

    // Cross-session memory: recall relevant past skills for the CEO.
    let memoryBlock = "";
    try {
      const skills = await recallMemory(ceo.name, text, 3);
      if (skills.length > 0) {
        memoryBlock = `\n--- Past learned techniques ---\n${skills.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n---`;
      }
    } catch { /* fail-open */ }

    // Build conversation context for natural responses
    const historyBlock = recent.length || transcript.length > 16
      ? await buildCompressedHistory(transcript.filter((m) => m.id !== userMessage.id), (msgs) => callModel(ceo, msgs)).catch(() => "")
      : "";

    let decision = null;
    let decisionError = null;
    try {
      const raw = await callModel(ceo, [
        { role: "system", content: ceoSystemPrompt(ceo, activeEmployees, supervisor) + memoryBlock + antiRepetition },
        {
          role: "user",
          content: [
            historyBlock,
            `Client says: ${text}`,
            "Decide now (JSON only):",
          ].filter(Boolean).join("\n\n"),
        },
      ]);
      decision = parseJsonReply(raw);
      if (!decision) decisionError = raw.slice(0, 300);
    } catch (error) {
      decisionError = error?.message || String(error);
    }

    if (!decision) {
      const errorMessage = await createNovaMessage({
        sessionId,
        agentId: ceo.id,
        agentName: ceo.name,
        agentRole: "ceo",
        role: "agent",
        type: "error",
        content: `CEO could not produce a valid decision${decisionError ? `: ${decisionError}` : ""}`,
      });
      onEvent({ type: "message", message: errorMessage });
      return;
    }

    const tasks = Array.isArray(decision.tasks) ? decision.tasks.slice(0, MAX_DELEGATIONS_PER_TURN) : [];

    // Handle 'hire' action — CEO creates a new employee
    if (decision.action === "hire" && decision.hire) {
      const h = decision.hire;
      try {
        const newAgent = registry.hireAgent(ceo.id, {
          name: h.name || "کارمند جدید",
          role: h.role || "employee",
          specialty: h.specialty || "",
          tools: h.tools || "terminal,browser",
        });
        // Persist to database so sidebar can see it
        try {
          await createNovaAgent({ name: newAgent.name, role: newAgent.role, specialty: newAgent.specialty, tools: newAgent.tools, modelId: newAgent.modelId, systemPrompt: newAgent.systemPrompt });
        } catch (dbErr) {
          logger.child("nova").warn("DB persist failed", { err: dbErr?.message });
        }
        onEvent({ type: "status", note: `New agent hired: ${newAgent.name}` });
      } catch (hireErr) {
        logger.child("nova").warn("auto-hire failed", { err: hireErr?.message });
      }
      const report = await createNovaMessage({
        sessionId, agentId: ceo.id, agentName: ceo.name, agentRole: "ceo",
        role: "agent", type: "report",
        content: String(decision.reply || "").trim() || "کارمند جدید استخدام شد.",
      });
      onEvent({ type: "message", message: report });
      return;
    }

    // Handle 'fire_and_hire' action — CEO fires and replaces
    if (decision.action === "fire_and_hire") {
      if (decision.fire) {
        try {
          registry.fireAgent(ceo.id, decision.fire.targetAgentId, decision.fire.reason || "عدم شایستگی");
          onEvent({ type: "status", note: `Agent fired: ${decision.fire.targetAgentId}` });
        } catch (fireErr) {
          logger.child("nova").warn("fire failed", { err: fireErr?.message });
        }
      }
      if (decision.hire) {
        try {
          const h = decision.hire;
          const newAgent = registry.hireAgent(ceo.id, {
            name: h.name || "جانشین",
            role: h.role || "employee",
            specialty: h.specialty || "",
            tools: h.tools || "terminal,browser",
          });
          try { await createNovaAgent({ name: newAgent.name, role: newAgent.role, specialty: newAgent.specialty, tools: newAgent.tools }); } catch {}
          onEvent({ type: "status", note: `Replacement hired: ${newAgent.name}` });
        } catch (hireErr) {
          logger.child("nova").warn("replacement hire failed", { err: hireErr?.message });
        }
      }
      const report = await createNovaMessage({
        sessionId, agentId: ceo.id, agentName: ceo.name, agentRole: "ceo",
        role: "agent", type: "report",
        content: String(decision.reply || "").trim() || "اخراج و جایگزینی انجام شد.",
      });
      onEvent({ type: "message", message: report });
      return;
    }

    if (decision.action !== "delegate" || tasks.length === 0) {
      const report = await createNovaMessage({
        sessionId,
        agentId: ceo.id,
        agentName: ceo.name,
        agentRole: "ceo",
        role: "agent",
        type: "report",
        content: String(decision.reply || "").trim() || "(empty reply)",
      });
      onEvent({ type: "message", message: report });
      return;
    }

    // CEO plan message.
    const plan = await createNovaMessage({
      sessionId,
      agentId: ceo.id,
      agentName: ceo.name,
      agentRole: "ceo",
      role: "agent",
      type: "plan",
      content: String(decision.reply || "").trim(),
      meta: { tasks: tasks.map((t) => ({ agentName: t.agentName, instruction: t.instruction })), tag: decision.tag || null },
    });
    onEvent({ type: "message", message: plan });

    // Resolve employees by name (case-insensitive).
    activeEmployeesRef = activeEmployees;
    const resolved = [];
    for (const t of tasks) {
      const name = String(t.agentName || "").trim().toLowerCase();
      const employee = activeEmployees.find((e) => e.name.toLowerCase() === name)
        || activeEmployees.find((e) => name.includes(e.name.toLowerCase()) || e.name.toLowerCase().includes(name))
        || (fuzzyMatchAgent(name, activeEmployees.map((e) => e.name))
          ? activeEmployees.find((e) => e.name === fuzzyMatchAgent(name, activeEmployees.map((e) => e.name)))
          : null);
      if (employee && t.instruction) resolved.push({ employee, instruction: String(t.instruction) });
    }

    if (resolved.length === 0) {
      const report = await createNovaMessage({
        sessionId,
        agentId: ceo.id,
        agentName: ceo.name,
        agentRole: "ceo",
        role: "agent",
        type: "report",
        content: String(decision.reply || "").trim() || "No matching employee found for delegation.",
      });
      onEvent({ type: "message", message: report });
      return;
    }

    // Create tasks first (all at once), then run them in parallel.
    const taskPromises = resolved.map(({ employee, instruction }) =>
      createNovaTask({
        sessionId,
        fromAgentId: ceo.id,
        fromAgentName: ceo.name,
        toAgentId: employee.id,
        toAgentName: employee.name,
        instruction,
      })
    );
    const createdTasks = await Promise.all(taskPromises);
    for (const task of createdTasks) onEvent({ type: "task", task });
    addTodos(sessionId, null, resolved.map((r) => r.instruction.slice(0, 200))).catch(() => {});

    // Run all employee tasks in PARALLEL for speed.
    const completed = await Promise.all(
      createdTasks.map((task, i) =>
        runEmployeeTask(task, resolved[i].employee, supervisor, recent, text, onEvent)
          .then((done) => ({ employee: resolved[i].employee, task: done }))
      )
    );

    // Final CEO report synthesizing employee results.
    onEvent({ type: "status", agentName: ceo.name, phase: "reporting" });

    const resultsBlock = completed.map(({ employee, task }) =>
      `[${employee.name}] (${task.status}${task.reviewStatus ? `, supervisor: ${task.reviewStatus}${task.reviewNote ? `: ${task.reviewNote}` : ""}` : ""}):\n${String(task.result || "").slice(0, 4000)}`
    ).join("\n\n");

    let finalText = "";
    try {
      finalText = await callModel(ceo, [
        {
          role: "system",
          content: [
            `You are "${ceo.name}", CEO of Nova Bot, reporting back to the client.`,
            "Synthesize your team's delivered work into one clear final answer in the client's language.",
            "If the supervisor flagged a task, be transparent about what is incomplete.",
            "Return the final report only.",
          ].join("\n"),
        },
        {
          role: "user",
          content: `Client request: ${text}\n\nTeam results:\n${resultsBlock}\n\nWrite the final report to the client now.`,
        },
      ]);
    } catch (error) {
      finalText = ` Final report failed: ${error?.message || error}\n\nRaw results:\n${resultsBlock}`;
    }

    const report = await createNovaMessage({
      sessionId,
      agentId: ceo.id,
      agentName: ceo.name,
      agentRole: "ceo",
      role: "agent",
      type: "report",
      content: finalText,
      meta: { taskIds: completed.map((c) => c.task.id) },
    });
    onEvent({ type: "message", message: report });
    indexMessage(sessionId, "agent", "final-report").catch(() => {});
  } catch (error) {
    console.error("[nova-turn-stack]", error instanceof Error ? error.stack : String(error));
    try { logT.fatal("runNovaTurn failed", { err: error instanceof Error ? error.stack : String(error), sessionId }); } catch {}
    onEvent({ type: "error", error: error?.message || String(error) });
  }
}

// ── Background re-review & automation suggestions ──

async function backgroundReReview() {
  try {
    const done = await getAdapterAllRecentTasks(6);
    const reviewed = ((await novaOpsKv.get("rereviewed", [])) || []);
    for (const t of done) {
      if (!t.id || reviewed.includes(t.id)) continue;
      if (t.reviewStatus !== "approved" || !t.completedAt) continue;
      const ageMin = (Date.now() - new Date(t.completedAt).getTime()) / 60000;
      if (ageMin < 45) continue;
      const sup = (await getNovaAgentsByRole("supervisor")).find((a) => a.status === "active");
      if (!sup) return;
      const verdict = await callModel(sup, [
        { role: "system", content: "Re-check this delivered task after some time. Reply ONLY JSON {\"verdict\":\"ok\"|\"concern\",\"note\":\"...\"} — note under 120 chars." },
        { role: "user", content: `Task: ${String(t.instruction || "").slice(0, 300)}\nResult: ${String(t.result || "").slice(0, 1500)}` },
      ]).catch(() => null);
      const parsed = parseJsonReply(verdict || "");
      if (parsed?.verdict === "concern") {
        await updateNovaTask(t.id, { reviewNote: `♻️ ${String(parsed.note || "").slice(0, 140)}` }).catch(() => {});
      }
      reviewed.unshift(t.id);
      await novaOpsKv.set("rereviewed", reviewed.slice(0, 200));
      break; // one per tick batch keeps cost tiny
    }
  } catch { /* best-effort */ }
}

async function getAdapterAllRecentTasks(n) {
  try {
    const db = (await import("@/lib/db/driver.js")).getAdapter;
    const a = await db();
    return a.all(`SELECT * FROM novaTasks ORDER BY createdAt DESC LIMIT ?`, [n]) || [];
  } catch { return []; }
}

async function generateSuggestions() {
  try {
    const tips = [];
    const schedules = await getSchedulesSafe();
    const topSkills = await topSkillsSafe(5);
    if (!schedules.length && topSkills.length >= 3) tips.push("چند مهارت پرکاربرد داری — یه زمان‌بند بساز که هر روز گزارش خلاصه بده.");
    if (schedules.length >= 3) tips.push("زمان‌بندت شلوغه — اولویت‌بندی تسک‌های cron رو بررسی کن.");
    if (tips.length) await novaOpsKv.set("suggestions", tips.slice(0, 5));
  } catch { /* best-effort */ }
}

async function getSchedulesSafe() {
  try { const m = await import("./skills.js"); return await m.getSchedules(); } catch { return []; }
}
async function topSkillsSafe(n) {
  try { const m = await import("./skills.js"); return await m.getAllSkills(""); } catch { return []; }
}

// ── Async delegation (Hermes async_delegation style) ──
// Fire-and-forget tasks: start now, keep chatting, poll results later.

export async function startAsyncDelegation({ sessionId, employeeName, instruction }) {
  const employees = (await getNovaAgentsByRole("employee")).filter((a) => a.status === "active");
  let employee = employees.find((e) => e.name.toLowerCase() === String(employeeName).toLowerCase());
  if (!employee && typeof fuzzyMatchAgent === "function") {
    const best = fuzzyMatchAgent(String(employeeName), employees.map((e) => e.name));
    if (best) employee = employees.find((e) => e.name === best);
  }
  if (!employee) return { ok: false, error: `no employee named "${employeeName}"` };
  activeEmployeesRef = employees;

  const ceo = (await getNovaAgentsByRole("ceo")).find((a) => a.status === "active");
  const supervisor = (await getNovaAgentsByRole("supervisor")).find((a) => a.status === "active");

  const task = await createNovaTask({
    sessionId,
    fromAgentId: ceo?.id || null,
    fromAgentName: ceo?.name || "async",
    toAgentId: employee.id,
    toAgentName: employee.name,
    instruction: `[async] ${String(instruction).slice(0, 2000)}`,
  });

  runEmployeeTask(task, employee, supervisor, [], "", () => {})
    .then((done) => {
      indexMessage(sessionId, "agent", `[async:${employee.name}] ${String(done.result || "").slice(0, 1500)}`).catch(() => {});
    })
    .catch(() => {});

  return { ok: true, taskId: task.id, agentName: employee.name };
}

export async function listAsyncTasks() {
  try {
    const dbGet = (await import("@/lib/db/driver.js")).getAdapter;
    const a = await dbGet();
    const rows = a.all(`SELECT id, toAgentName, instruction, status, result FROM novaTasks WHERE instruction LIKE '[async]%' ORDER BY createdAt DESC LIMIT 12`) || [];
    return rows.map((r) => ({ id: r.id, agentName: r.toAgentName, status: r.status, preview: String(r.result || "").slice(0, 200) }));
  } catch { return []; }
}
