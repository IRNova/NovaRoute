<div dir="rtl">

# ۸. مرجع API

دو خانوادهٔ کاملاً جدا وجود دارد و احراز هویتشان یکی نیست:

| خانواده | پیشوند | احراز هویت |
|---|---|---|
| دروازه (ترافیک مدل) | `/v1`، `/v1beta`، `/codex` | کلید `API` دروازه |
| مدیریت | `/api/*` | کوکی نشست داشبورد، یا کلید با دامنهٔ `manage`/`admin`، یا توکن `CLI` |

## دروازه

### احراز هویت

هر سه شکل زیر پذیرفته می‌شود تا کلاینت‌های مختلف بدون تغییر کار کنند:

```
Authorization: Bearer <کلید>
x-api-key: <کلید>
x-goog-api-key: <کلید>
```

از این نسخه، کلید اجباری است مگر برای درخواست‌های `loopback` و شبکهٔ خصوصی وقتی `Require API Key` را خاموش کرده باشید.

پس از چند بار احراز هویت ناموفق، نشانی `IP` به‌طور خودکار مسدود می‌شود (`NR_AUTOBAN_*`).

### نمونهٔ گفتگو (سازگار با `OpenAI`)

```bash
curl -s http://localhost:20126/v1/chat/completions \
  -H "Authorization: Bearer $NOVA_KEY" \
  -H "content-type: application/json" \
  -d '{
    "model": "gpt-5-mini",
    "stream": true,
    "messages": [{"role": "user", "content": "سلام"}]
  }'
```

### نمونهٔ سازگار با `Claude`

```bash
curl -s http://localhost:20126/v1/messages \
  -H "x-api-key: $NOVA_KEY" \
  -H "content-type: application/json" \
  -d '{"model":"claude-sonnet-4","max_tokens":512,"messages":[{"role":"user","content":"سلام"}]}'
```

### نمونهٔ سازگار با `Gemini`

```bash
curl -s "http://localhost:20126/v1beta/models/gemini-2.5-pro:generateContent?key=$NOVA_KEY" \
  -H "content-type: application/json" \
  -d '{"contents":[{"parts":[{"text":"سلام"}]}]}'
```

### فهرست کامل نقطه‌های دروازه

| مسیر | کار |
|---|---|
| `POST /v1/chat/completions` | گفتگو (جریانی و غیرجریانی) |
| `POST /v1/messages` | قالب `Claude` |
| `POST /v1/messages/count_tokens` | شمارش توکن |
| `POST /v1/responses` | قالب `Responses` (`Codex`) |
| `POST /v1/responses/compact` | فشرده‌سازی گفتگوی طولانی |
| `POST /v1/embeddings` | تعبیه‌سازی |
| `GET /v1/models`، `/v1/models/[kind]`، `/v1/models/info` | فهرست و مشخصات مدل‌ها |
| `POST /v1/images/generations` | تولید تصویر |
| `POST /v1/audio/speech`، `/v1/audio/transcriptions`، `GET /v1/audio/voices` | گفتار و رونویسی |
| `POST /v1/videos/generations`، `/v1/videos/edits`، `/v1/videos/extensions`، `GET /v1/videos/[id]` | ویدئو |
| `POST /v1/search` | جستجوی وب |
| `POST /v1/web/fetch` | دریافت صفحهٔ وب |
| `POST /v1beta/models/...` | خانوادهٔ `Gemini` |

## مدیریت

مسیرهای `/api/*` پیش‌فرض بسته‌اند: هر چه در فهرست عمومی نباشد نیاز به احراز هویت دارد.

### مسیرهای عمومی (بدون احراز هویت)

`‎/api/health`، `‎/api/version`، `‎/api/public-status`، `‎/api/locale`، `‎/api/init`، `‎/api/auth/login`، `‎/api/auth/logout`، `‎/api/auth/status`، `‎/api/auth/oidc/*`، `‎/api/settings/require-login`، `‎/api/providers/default-models`، `‎/api/setup` (با شرط‌های [بند ۱ گزارش](05-security-report.md))، و `‎/api/dashboard/nova/telegram/webhook` (که با راز خود `Telegram` احراز می‌شود).

### مسیرهای همیشه محافظت‌شده

`‎/api/shutdown`، `‎/api/settings/database*`، `‎/api/version/update`، `‎/api/version/shutdown`، `‎/api/setup/update`، `‎/api/oauth/*/auto-import`.

### مسیرهای فقط محلی

مسیرهایی که فرایند فرزند اجرا می‌کنند یا راز میزبان می‌خوانند فقط از `loopback` و با احراز هویت کار می‌کنند: `‎/api/cli-tools/*`، `‎/api/mcp/*`، `‎/api/tunnel/*`، `‎/api/auth/reset-password`، `‎/api/headroom/*`.

### گروه‌های اصلی

| گروه | نمونه |
|---|---|
| کلیدها | `GET/POST/DELETE /api/keys` |
| ارائه‌دهنده‌ها | `/api/providers`، `/api/providers/[id]/models`، `/api/providers/[id]/test` |
| کامبوها | `/api/combos` |
| مصرف و هزینه | `/api/usage`، `/api/costs`، `/api/analytics` |
| تنظیمات | `/api/settings`، `/api/settings/database` |
| پایش | `/api/monitoring`، `/api/routing-stats`، `/api/metrics` |
| امنیت | `/api/security/audit` (ثبت رخداد اقدام‌های مدیریتی) |
| کاربران | `/api/users`، `/api/users/[id]` (فقط `admin`) |
| کانال‌ها | `/api/channels`، `/api/channels/[id]`، `/api/channels/webhook/[id]` |
| عامل و ربات | `/api/dashboard/nova/*` |

### قانون هشدار (قالب تازه)

```bash
curl -s -X POST http://localhost:20126/api/monitoring \
  -H "content-type: application/json" -b "auth_token=..." \
  -d '{
    "action": "add-alert-rule",
    "name": "too many errors",
    "severity": "warning",
    "message": "error rate is climbing",
    "condition": { "source": "counters", "metric": "req.errors", "op": ">", "value": 5 }
  }'
```

قالب قدیمی (`conditionFn` به‌صورت رشتهٔ `JavaScript`) دیگر پذیرفته نمی‌شود و پاسخ `400` می‌گیرد؛ دلیلش در [بند ۵ گزارش](05-security-report.md) آمده است.

### نقطه‌های پیاده‌نشده

این‌ها پاسخ می‌دهند ولی چیزی ذخیره نمی‌کنند. خواندن، دادهٔ خالی به‌همراه `implemented: false` برمی‌گرداند و نوشتن پاسخ `501` می‌دهد:

`‎/api/usage/budgets`، `‎/api/usage/evals`، `‎/api/usage/sessions`، `‎/api/cloud-sync`، `‎/api/runtime`، `‎/api/settings/proxies`، `‎/api/tailscale`، `‎/api/vscode-token`، `‎/api/compression`، `‎/api/tunnels`، `‎/api/a2a`.

## سنجه‌ها

```bash
curl -H "Authorization: Bearer $METRICS_TOKEN" https://gateway.example.com/api/metrics
```

خروجی قالب متنی `Prometheus` است. مهم‌ترین سنجه‌ها:

| سنجه | معنی |
|---|---|
| `novaroute_requests_total{provider,model,outcome}` | تعداد درخواست ۲۴ ساعت گذشته |
| `novaroute_tokens_total{provider,model,direction}` | توکن ورودی و خروجی |
| `novaroute_cost_usd_total{provider,model}` | هزینه به دلار |
| `novaroute_key_requests_total{key}` و `novaroute_key_cost_usd_total{key}` | به تفکیک کلید |
| `novaroute_key_requests_current_minute{key}` | مصرف زندهٔ سقف نرخ |
| `novaroute_key_requests_in_flight{key}` | درخواست‌های در حال اجرا |
| `novaroute_provider_connections{state}` | اتصال‌های فعال و غیرفعال |

## سقف نرخ هر کلید

هنگام ساخت یا ویرایش کلید:

```bash
curl -X POST https://gateway.example.com/api/keys \
  -b "auth_token=..." -H 'content-type: application/json' \
  -d '{"name":"mobile app","rpmLimit":60,"concurrencyLimit":4,
       "usageLimitEnabled":true,"dailyUsageLimitUsd":5}'
```

وضعیت زنده:

```bash
curl -b "auth_token=..." https://gateway.example.com/api/keys/<id>/usage-limits
# { "usage": { "dailySpentUsd": 1.2, ... },
#   "rate": { "rpmLimit": 60, "usedThisMinute": 12, "activeRequests": 1 } }
```

عبور از سقف پاسخ `429` می‌دهد، به‌همراه هدرهای `Retry-After`، `X-RateLimit-Limit` و `X-RateLimit-Remaining`. این سقف‌ها روی همهٔ سطح‌های دروازه اعمال می‌شوند: گفتگو، تعبیه‌سازی، تصویر، ویدئو، گفتار، رونویسی، جستجو و دریافت صفحهٔ وب.

## ثبت رخداد

```bash
curl -b "auth_token=..." "https://gateway.example.com/api/security/audit?limit=50&sensitive=1"
```

## کاربران و نقش‌ها

```bash
# فهرست حساب‌ها (فقط admin)
curl -b "auth_token=..." https://gateway.example.com/api/users

# ساخت حساب
curl -X POST -b "auth_token=..." -H 'content-type: application/json' \
  -d '{"username":"sara","password":"...","role":"operator"}' \
  https://gateway.example.com/api/users

# تغییر نقش یا غیرفعال کردن
curl -X PATCH -b "auth_token=..." -H 'content-type: application/json' \
  -d '{"role":"viewer"}' https://gateway.example.com/api/users/<id>
```

ورود با نام کاربری:

```bash
curl -X POST -H 'content-type: application/json' \
  -d '{"username":"sara","password":"..."}' \
  https://gateway.example.com/api/auth/login
```

درخواستی که از سقف نقش عبور کند پاسخ `403` با کد `forbidden_role` می‌گیرد.

## کدهای خطا

| کد | معنی |
|---|---|
| `401` | کلید یا نشست نامعتبر |
| `403` | احراز هویت درست است ولی مجوز کافی نیست (یا درخواست از راه دور برای مسیر محلی) |
| `429` | قفل ورود یا محدودیت نرخ |
| `409` | تضاد عمدی، مثل حذف آخرین حساب `admin` |
| `501` | قابلیت هنوز پیاده نشده |
| `502` | خطای بالادست ارائه‌دهنده |

</div>
