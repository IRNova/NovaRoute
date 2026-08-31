---
name: novaroute-tts
description: Text-to-speech via NovaRoute /v1/audio/speech using OpenAI / ElevenLabs / Azure / Google / Amazon / Kokoro / self-hosted models. Use when the user wants to convert text to speech, generate audio, or create voice output.
---

# NovaRoute — Text-to-Speech

Requires `NOVAROUTE_URL` (and `NOVAROUTE_KEY` if auth enabled). See https://raw.githubusercontent.com/IRNova/NovaRoute/refs/heads/main/skills/novaroute/SKILL.md for setup.

## Discover

```bash
curl $NOVAROUTE_URL/v1/models/tts | jq '.data[].id'
curl "$NOVAROUTE_URL/v1/models/info?id=openai/tts-1"
```

## Endpoint

`POST $NOVAROUTE_URL/v1/audio/speech`

| Field | Required | Notes |
|---|---|---|
| `model` | yes | from `/v1/models/tts` |
| `input` | yes | text to speak |
| `voice` | no | provider-dependent voice name |
| `response_format` | no | `mp3` (default), `wav`, `opus`, `flac` |
| `speed` | no | 0.25 to 4.0 (default 1.0) |

## Examples

```bash
curl -X POST $NOVAROUTE_URL/v1/audio/speech \
  -H "Authorization: Bearer $NOVAROUTE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"openai/tts-1","input":"Hello world","voice":"alloy"}' \
  --output speech.mp3
```

JS:

```js
const r = await fetch(`${process.env.NOVAROUTE_URL}/v1/audio/speech`, {
  method: "POST",
  headers: { "Authorization": `Bearer ${process.env.NOVAROUTE_KEY}`, "Content-Type": "application/json" },
  body: JSON.stringify({ model: "openai/tts-1", input: "Hello world", voice: "alloy" }),
});
const buffer = Buffer.from(await r.arrayBuffer());
require("fs").writeFileSync("speech.mp3", buffer);
```

## Self-hosted

Point `providerSpecificData.baseUrl` to your local server:
- Kokoro-FastAPI: `http://host:8880`
- openedai-speech: `http://host:8080`
