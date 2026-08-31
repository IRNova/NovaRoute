---
name: novaroute-web-fetch
description: Fetch URLs as markdown via NovaRoute /v1/fetch. Use when the user wants to read a webpage, extract content from a URL, or convert HTML to readable text.
---

# NovaRoute — Web Fetch

Requires `NOVAROUTE_URL` (and `NOVAROUTE_KEY` if auth enabled). See https://raw.githubusercontent.com/IRNova/NovaRoute/refs/heads/main/skills/novaroute/SKILL.md for setup.

## Endpoint

`POST $NOVAROUTE_URL/v1/fetch`

| Field | Required | Notes |
|---|---|---|
| `url` | yes | URL to fetch |
| `max_chars` | no | max characters to return (default 10000) |
| `extract_mode` | no | `markdown` (default) / `text` / `html` |

## Examples

```bash
curl -X POST $NOVAROUTE_URL/v1/fetch \
  -H "Authorization: Bearer $NOVAROUTE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com","max_chars":5000}'
```

JS:

```js
const r = await fetch(`${process.env.NOVAROUTE_URL}/v1/fetch`, {
  method: "POST",
  headers: { "Authorization": `Bearer ${process.env.NOVAROUTE_KEY}`, "Content-Type": "application/json" },
  body: JSON.stringify({ url: "https://example.com", max_chars: 5000 }),
});
const { content, url, title } = await r.json();
console.log(content); // Markdown content
```

## Response shape

```json
{
  "url": "https://example.com",
  "title": "Example Domain",
  "content": "# Example Domain\n\nThis domain is for use in illustrative examples...",
  "extracted_at": "2026-08-24T12:00:00Z",
  "char_count": 1234
}
```
