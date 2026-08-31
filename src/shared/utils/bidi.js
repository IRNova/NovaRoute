/**
 * Bidirectional-text helpers.
 *
 * NovaRoute's shell defaults to Farsi RTL, but most strings in the codebase are
 * authored in English and only some are translated at runtime. That mixture is
 * what produces the classic bidi failures:
 *
 *   - a fully English sentence inside an RTL container renders with its
 *     sentence-final period at the FRONT: ".Manage upstream AI providers"
 *   - a Latin run embedded in Farsi copy (a model id, a URL, a version) bleeds
 *     into the surrounding text and reorders neighbouring punctuation
 *
 * The house rule across Nova properties is to wrap embedded Latin/English runs
 * in Unicode isolates: LRI (U+2066) ... PDI (U+2069). Isolates are stronger
 * than the older LRM marks because the isolated run cannot influence the
 * ordering of the text around it at all.
 *
 * Which tool to reach for:
 *
 *   - a WHOLE English paragraph sitting in an RTL container
 *       -> dir="auto" on the element, or the global `unicode-bidi: plaintext`
 *          rule in globals.css. No JS needed.
 *   - a string COMPOSED at runtime from mixed-direction parts
 *       (`${translate("Version")} v${version}`, `${count} connections`)
 *       -> isolateLatin() or ltr() from this module.
 */

/** LEFT-TO-RIGHT ISOLATE. Opens an isolated LTR run. */
export const LRI = "⁦";
/** RIGHT-TO-LEFT ISOLATE. Opens an isolated RTL run. */
export const RLI = "⁧";
/** FIRST STRONG ISOLATE. Direction taken from the run's first strong char. */
export const FSI = "⁨";
/** POP DIRECTIONAL ISOLATE. Closes the innermost isolate. */
export const PDI = "⁩";

// Arabic, Hebrew, and the Arabic presentation forms Farsi actually uses.
const RTL_CHAR =
  /[֐-׿؀-ۿ܀-ݏݐ-ݿࢠ-ࣿיִ-﷽ﹰ-ﻼ]/;

// A Latin run: starts on a Latin letter or digit and may carry the punctuation
// that legitimately lives INSIDE an identifier (model ids, URLs, versions,
// file paths, emails). Trailing sentence punctuation is deliberately excluded
// so it stays with the surrounding RTL sentence.
const LATIN_RUN =
  /[A-Za-z0-9][A-Za-z0-9._:/\\@#+&'’-]*(?:[ \t]+[A-Za-z0-9][A-Za-z0-9._:/\\@#+&'’-]*)*/g;

/** True when the string contains any strong RTL character. */
export function hasRtl(value) {
  return typeof value === "string" && RTL_CHAR.test(value);
}

/** True when the string contains any strong Latin character. */
export function hasLatin(value) {
  return typeof value === "string" && /[A-Za-z]/.test(value);
}

/**
 * Wrap every embedded Latin run in LRI/PDI isolates.
 *
 * No-ops on strings with no RTL content: a purely English string does not need
 * per-run isolation, it needs the ELEMENT to be dir="auto"/"ltr". Isolating
 * there would only add invisible characters that break `===` comparisons and
 * the runtime translation lookup.
 */
export function isolateLatin(value) {
  if (typeof value !== "string" || !value) return value;
  if (!hasRtl(value) || !hasLatin(value)) return value;
  return value.replace(LATIN_RUN, (run) => `${LRI}${run}${PDI}`);
}

/**
 * Force a value to render as a self-contained LTR run.
 *
 * For things that are ALWAYS LTR regardless of surrounding copy: versions,
 * counts, ids, URLs, model names, timestamps, byte sizes.
 */
export function ltr(value) {
  if (value == null || value === "") return value;
  return `${LRI}${value}${PDI}`;
}

/**
 * Isolate a run and let its own first strong character pick the direction.
 * Use for user-supplied values that could be in either script.
 */
export function isolate(value) {
  if (value == null || value === "") return value;
  return `${FSI}${value}${PDI}`;
}

/**
 * Direction hint for a `dir` attribute.
 *
 * Prefer passing the literal string "auto" when you simply want the browser to
 * decide. Use this when you need the resolved value in JS as well.
 */
export function autoDir(value) {
  if (!hasRtl(value)) return "ltr";
  return "rtl";
}

/** Strip every isolate character. For comparisons, logging, and clipboard. */
export function stripBidi(value) {
  if (typeof value !== "string") return value;
  return value.replace(/[⁦-⁩‎‏]/g, "");
}
