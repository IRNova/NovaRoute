// Text for a dashboard action item.
//
// The API returns a translation key plus parameters rather than a finished
// sentence, so the client composes it after translating. This lived inline in
// the dashboard home page; it moved here when action items became notifications
// so the bell and anything else render them identically.

/**
 * @param {{key: string, provider?: string, label?: string}} item
 * @param {(s: string) => string} translate
 * @returns {string}
 */
export function formatActionItem(item, translate = (s) => s) {
  if (!item || !item.key) return "";
  const provider = item.provider || "";
  switch (item.key) {
    case "Provider connection failing": {
      const suffix = item.label ? ` (${item.label})` : "";
      return `${translate(item.key)}: ${provider}${suffix}`;
    }
    case "Quota or rate limit hit on":
    case "Credit or quota errors detected on":
      return `${translate(item.key)} ${provider}`.trim();
    default:
      return translate(item.key);
  }
}
