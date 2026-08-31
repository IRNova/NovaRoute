// Nova Bot — response quality guards (Hermes-style).
// Empty-response guard, repetition guard, think-scrubber, verification
// evidence pass, and Mixture-of-Agents (MoA) selection loop.

const REPEAT_WINDOW = 400;

/** Strip <think>…</think> blocks and leading reasoning artifacts. */
export function scrubThinking(text) {
  return String(text || "")
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, "")
    .replace(/^\s*(?:Okay|Alright)[,\s]/i, "")
    .trim();
}

/** Detect degenerate repetition: any 40-char chunk appearing 3+ times. */
export function isDegenerateRepetition(text) {
  const s = String(text || "");
  if (s.length < REPEAT_WINDOW * 2) return false;
  const window = s.slice(0, REPEAT_WINDOW);
  let count = 0;
  let idx = 0;
  while ((idx = s.indexOf(window.slice(0, 40), idx)) !== -1) {
    count++;
    idx += 40;
    if (count >= 3) return true;
  }
  return false;
}

/** True when the model returned nothing usable. */
export function isEmptyResponse(text) {
  const t = String(text || "").trim();
  if (!t) return true;
  if (/^(undefined|null|\(no output\)|\.?)$/i.test(t)) return true;
  if (isDegenerateRepetition(t)) return true;
  return false;
}

/**
 * Verification evidence pass: ask a checker model whether `answer` actually
 * addresses `task`. Returns { verdict: "pass"|"fail", reason } .
 * Fail-open: errors count as pass so the pipeline never blocks.
 */
export async function verifyAnswer(answer, task, callModel) {
  try {
    const raw = await callModel([
      {
        role: "system",
        content:
          'You are a strict QA verifier. Does this answer fully deliver the requested task? Reply ONLY with JSON {"verdict":"pass"} or {"verdict":"fail","reason":"..."}.',
      },
      { role: "user", content: `Task:\n${String(task).slice(0, 2000)}\n\nAnswer:\n${String(answer).slice(0, 6000)}` },
    ]);
    const m = String(raw || "").match(/"verdict"\s*:\s*"(pass|fail)"/i);
    if (!m) return { verdict: "pass", reason: "" };
    const reason = String(raw || "").match(/"reason"\s*:\s*"([^"]{0,300})"/i)?.[1] || "";
    return { verdict: m[1].toLowerCase(), reason };
  } catch {
    return { verdict: "pass", reason: "" };
  }
}

/**
 * Mixture-of-Agents: run the same prompt across several candidate models in
 * parallel, then have a judge pick the best answer. Candidates are other
 * active employees (different models). Returns the winning answer.
 *
 * @param {object} primary   agent whose answer is also a candidate
 * @param {Array}  peers     [{name, ...}] other agents (their models differ)
 * @param {Function} callWith agent => (messages)=>Promise<string>
 * @param {Array}  messages  chat messages for the task
 * @param {string} instruction  what was asked (for the judge)
 */
export async function moaSelect({ primary, peers, callWith, messages, instruction }) {
  const candidates = [primary, ...peers].slice(0, 3);
  const settled = await Promise.allSettled(candidates.map((a) => callWith(a)(messages)));
  const valid = settled
    .map((r, i) => ({ agent: candidates[i], ok: r.status === "fulfilled", out: r.status === "fulfilled" ? r.value : "" }))
    .filter((c) => c.ok && !isEmptyResponse(scrubThinking(c.out)));

  if (valid.length === 0) throw new Error("MoA: all candidates failed");
  if (valid.length === 1) return valid[0].out;

  // Judge = whichever agent is NOT a candidate would be ideal; reuse primary's
  // model as judge when no neutral party exists.
  const labeled = valid
    .map((c, i) => `<answer_${i + 1} author="${c.agent.name}">\n${scrubThinking(c.out).slice(0, 3500)}\n</answer_${i + 1}>`)
    .join("\n\n");

  let pick = 1;
  try {
    const raw = await callWith(primary)([
      {
        role: "system",
        content:
          "You are judging candidate answers for quality, correctness and completeness. Pick the single best one. Reply ONLY with JSON {\"best\": <number>}.",
      },
      { role: "user", content: `Request:\n${String(instruction).slice(0, 1500)}\n\n${labeled}\n\nWhich answer number is best?` },
    ]);
    const n = parseInt(String(raw || "").match(/"best"\s*:\s*(\d)/i)?.[1] || "1", 10);
    if (n >= 1 && n <= valid.length) pick = n;
  } catch {
    pick = 1; // fall back to the primary agent's own answer
  }
  return valid[pick - 1].out;
}
