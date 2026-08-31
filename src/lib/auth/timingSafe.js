import crypto from "node:crypto";

/**
 * Constant-time string comparison. Pads both sides to the same length so
 * timingSafeEqual never throws and length is not leaked through early exit.
 */
export function timingSafeEqualStr(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  const len = Math.max(ab.length, bb.length);
  if (len === 0) return true;
  const pa = Buffer.concat([ab, Buffer.alloc(len - ab.length)]);
  const pb = Buffer.concat([bb, Buffer.alloc(len - bb.length)]);
  // Zero padding alone would make a secret and that same secret plus trailing
  // NUL bytes compare equal, so the length is folded into the result (after
  // the constant-time compare, never as an early return).
  const equal = crypto.timingSafeEqual(pa, pb);
  return equal && ab.length === bb.length;
}
