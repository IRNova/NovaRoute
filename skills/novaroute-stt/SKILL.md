---
name: novaroute-stt
description: Speech-to-text via NovaRoute /v1/audio/transcriptions using OpenAI Whisper / Azure / Google / Deepgram / self-hosted models. Use when the user wants to transcribe audio, convert speech to text, or recognize voice.
---

# NovaRoute — Speech-to-Text

Requires `NOVAROUTE_URL` (and `NOVAROUTE_KEY` if auth enabled). See https://raw.githubusercontent.com/IRNova/NovaRoute/refs/heads/main/skills/novaroute/SKILL.md for setup.

## Discover

```bash
curl $NOVAROUTE_URL/v1/models/stt | jq '.data[].id'
curl "$NOVAROUTE_URL/v1/models/info?id=openai/whisper-1"
```

## Endpoint

`POST $NOVAROUTE_URL/v1/audio/transcriptions`

| Field | Required | Notes |
|---|---|---|
| `model` | yes | from `/v1/models/stt` |
| `file` | yes | audio file (multipart/form-data) |
| `language` | no | ISO 639-1 code (e.g. `en`, `fa`) |
| `prompt` | no | context/prompt for transcription |
| `response_format` | no | `json` (default), `text`, `srt`, `verbose_json` |

## Examples

```bash
curl -X POST $NOVAROUTE_URL/v1/audio/transcriptions \
  -H "Authorization: Bearer $NOVAROUTE_KEY" \
  -F "model=openai/whisper-1" \
  -F "file=@audio.mp3" \
  -F "language=en"
```

JS:

```js
const FormData = require("form-data");
const fs = require("fs");
const form = new FormData();
form.append("model", "openai/whisper-1");
form.append("file", fs.createReadStream("audio.mp3"));
form.append("language", "en");

const r = await fetch(`${process.env.NOVAROUTE_URL}/v1/audio/transcriptions`, {
  method: "POST",
  headers: { "Authorization": `Bearer ${process.env.NOVAROUTE_KEY}`, ...form.getHeaders() },
  body: form,
});
console.log(await r.json());
```

## Self-hosted

Point `providerSpecificData.baseUrl` to your local server:
- whisper.cpp: `http://host:8080/v1/audio/transcriptions`
- faster-whisper: `http://host:8000/v1/audio/transcriptions`
