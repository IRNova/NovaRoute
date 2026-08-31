---
name: novaroute-video
description: Generate videos via NovaRoute using Runway / Pika / Kling / Sora / Minimax / self-hosted models. Use when the user wants to create, generate, or render a video from text or images.
---

# NovaRoute — Video Generation

Requires `NOVAROUTE_URL` (and `NOVAROUTE_KEY` if auth enabled). See https://raw.githubusercontent.com/IRNova/NovaRoute/refs/heads/main/skills/novaroute/SKILL.md for setup.

## Discover

```bash
curl $NOVAROUTE_URL/v1/models/video | jq '.data[].id'
curl "$NOVAROUTE_URL/v1/models/info?id=runway/gen-3"
```

## Endpoint

`POST $NOVAROUTE_URL/v1/video/generations`

| Field | Required | Notes |
|---|---|---|
| `model` | yes | from `/v1/models/video` |
| `prompt` | yes | video description |
| `image` | no | reference image URL (img2vid) |
| `duration` | no | seconds (provider-dependent) |
| `resolution` | no | `480p`, `720p`, `1080p` |

## Examples

```bash
curl -X POST $NOVAROUTE_URL/v1/video/generations \
  -H "Authorization: Bearer $NOVAROUTE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"runway/gen-3","prompt":"A cat walking on the beach at sunset","duration":5}'
```

JS:

```js
const r = await fetch(`${process.env.NOVAROUTE_URL}/v1/video/generations`, {
  method: "POST",
  headers: { "Authorization": `Bearer ${process.env.NOVAROUTE_KEY}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    model: "runway/gen-3",
    prompt: "A cat walking on the beach at sunset",
    duration: 5
  }),
});
const { data } = await r.json();
console.log(data[0].url); // Video URL
```

## Response shape

```json
{
  "created": 1735000000,
  "data": [
    {
      "url": "https://...",
      "duration": 5,
      "resolution": "720p",
      "model": "runway/gen-3"
    }
  ]
}
```

## Provider quirks

| Provider | Notes |
|---|---|
| `runway` | High quality, async polling |
| `pika` | Fast, text-to-video |
| `kling` | Chinese provider, good quality |
| `minimax` | Affordable, decent quality |
| `sora` | OpenAI, high quality |
