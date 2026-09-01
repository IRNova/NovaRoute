// Action item text composition. Runs with: node --test "tests/unit/*.test.js"
//
// The API returns a translation key plus parameters, never a finished sentence,
// so that the provider name is not fed through the translator. These items now
// render in the notification bell instead of as a stack of banners in the
// middle of the dashboard.
import test from "node:test";
import assert from "node:assert/strict";
import { formatActionItem } from "../../src/shared/utils/actionItems.js";

// Stand-in for a real dictionary: proves the key is translated and the
// provider name is not.
// "groq" is deliberately IN this dictionary. A provider name must never be
// looked up, so if the implementation passes it through translate the test
// sees the substituted value and fails. Without that entry the assertion is
// vacuous: translate() would be an identity function on the provider name and
// the bug would pass unnoticed.
const fa = (s) => ({
  "Provider connection failing": "اتصال ارائه‌دهنده ناموفق است",
  "Quota or rate limit hit on": "سقف مصرف پر شد روی",
  "Credit or quota errors detected on": "خطای اعتبار یا سهمیه روی",
  "Dashboard is still using a weak default password": "رمز پیش‌فرض هنوز فعال است",
  groq: "TRANSLATED_PROVIDER_NAME",
}[s] || s);

test("a failing provider names the provider and its connection label", () => {
  const item = { key: "Provider connection failing", provider: "openai", label: "work key" };
  assert.equal(formatActionItem(item, (s) => s), "Provider connection failing: openai (work key)");
});

test("the label is omitted when there is none", () => {
  const item = { key: "Provider connection failing", provider: "openai", label: "" };
  assert.equal(formatActionItem(item, (s) => s), "Provider connection failing: openai");
});

test("only the key is translated, never the provider name", () => {
  const out = formatActionItem({ key: "Quota or rate limit hit on", provider: "groq" }, fa);
  assert.ok(out.includes("groq"), "provider name must survive untranslated");
  assert.ok(!out.includes("TRANSLATED_PROVIDER_NAME"), "provider name must not be sent through translate");
  assert.ok(out.startsWith("سقف مصرف پر شد روی"), "key must be translated");
});

test("a key with no parameters is translated on its own", () => {
  assert.equal(
    formatActionItem({ key: "Dashboard is still using a weak default password" }, fa),
    "رمز پیش‌فرض هنوز فعال است"
  );
});

test("an unknown key falls through to plain translation, not a crash", () => {
  assert.equal(formatActionItem({ key: "Something new" }, (s) => s), "Something new");
});

test("a malformed item renders nothing rather than 'undefined'", () => {
  assert.equal(formatActionItem(null, (s) => s), "");
  assert.equal(formatActionItem({}, (s) => s), "");
  assert.equal(formatActionItem({ key: "" }, (s) => s), "");
});

test("a missing provider does not leave a dangling separator", () => {
  const out = formatActionItem({ key: "Quota or rate limit hit on" }, (s) => s);
  assert.equal(out, "Quota or rate limit hit on");
});
