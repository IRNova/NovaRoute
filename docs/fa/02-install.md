<div dir="rtl">

# ۲. نصب و راه‌اندازی

## پیش‌نیازها

- `Linux` با `systemd` (اسکریپت نصب برای `Debian`/`Ubuntu`، `RHEL`/`Rocky` و مشتقات نوشته شده)
- `Node.js` نسخهٔ ۲۰ یا بالاتر (اسکریپت خودش نصب می‌کند)
- دسترسی `root`
- حداقل ۱ گیگابایت حافظه برای مرحلهٔ ساخت (`next build`)

## روش ۱: نصب یک‌خطی (پیشنهادی برای سرور)

```bash
curl -fsSL https://raw.githubusercontent.com/IRNova/NovaRoute/main/install.sh | sudo bash
```

اسکریپت این کارها را انجام می‌دهد:

1. `Node.js` را در صورت نبود نصب می‌کند.
2. مخزن را در `/opt/novaroute` کلون می‌کند و دادهٔ اجرایی را در `/var/lib/novaroute` می‌گذارد.
3. فایل `.env` می‌سازد و برای `JWT_SECRET`، `API_KEY_SECRET`، `MACHINE_ID_SALT` و `INITIAL_PASSWORD` مقدار تصادفی تولید می‌کند.
4. `npm install && npm run build` را اجرا و سپس وابستگی‌های توسعه را هرس می‌کند.
5. سرویس `systemd` به نام `novaroute` می‌سازد و فعال می‌کند.
6. پورت را روی `ufw` یا `firewalld` باز می‌کند.
7. اگر دامنه بدهید، `Caddy` را نصب و گواهی `TLS` را خودکار می‌گیرد.

> **رمز اولیه فقط یک بار چاپ می‌شود.** خط `Initial password:` را در خروجی نصب پیدا و ذخیره کنید. همان مقدار در `INSTALL_DIR/.env` زیر کلید `INITIAL_PASSWORD` هم هست.

### بلافاصله بعد از نصب

۱. داشبورد را باز کنید و تنظیم اولیه را کامل کنید:

```
http://<آدرس-سرور>:20126/setup
```

اگر از یک دستگاه دیگر (نه خود سرور) این کار را می‌کنید، پنل رمز اولیه را می‌پرسد. این عمدی است: بدون آن، هر کسی که زودتر به پورت برسد می‌تواند پنل را تصاحب کند.

۲. یک کلید `API` بسازید (`Dashboard > API Keys`). از این نسخه به بعد دروازه به‌صورت پیش‌فرض کلید می‌خواهد.

۳. بررسی وضعیت امنیتی:

```bash
cd /opt/novaroute && node scripts/nova-security-audit.mjs --fa
```

## روش ۲: نصب با دامنه و HTTPS

اگر دامنه‌ای دارید که رکورد `A` آن به سرور اشاره می‌کند:

```bash
DOMAIN=gateway.example.com curl -fsSL https://raw.githubusercontent.com/IRNova/NovaRoute/main/install.sh | sudo bash
```

`Caddy` روی پورت ۴۴۳ (یا پورت دلخواه با `HTTPS_PORT_FORCE`) می‌نشیند و به `127.0.0.1:20126` پروکسی می‌کند. در این حالت کوکی نشست خودکار پرچم `Secure` می‌گیرد.

## روش ۳: Docker

```bash
docker compose up -d
```

فایل `docker-compose.yml` و `Dockerfile` در ریشهٔ مخزن هستند. پیش از اجرا حتماً `.env` را از روی `.env.example` بسازید و مقدارهای امنیتی را پر کنید؛ تصویر `Docker` مقدار تصادفی تولید نمی‌کند.

## روش ۴: نصب دستی (برای توسعه)

```bash
git clone https://github.com/IRNova/NovaRoute.git
cd NovaRoute
cp .env.example .env
npm install
npm run dev            # حالت توسعه روی پورت ۲۰۱۲۷
# یا
npm run build && PORT=20128 HOSTNAME=0.0.0.0 npm start
```

## پورت‌ها

| پورت | کاربرد |
|---|---|
| `20126` | پیش‌فرض نصب سرور (`install.sh`) |
| `20127` | پیش‌فرض حالت توسعه (`next dev`) |
| `20128` | پیش‌فرض زمان اجرا در مستندات قدیمی‌تر و ابزار `CLI` |

اگر پورت را تغییر دادید، مقدارهای `PORT`، `BASE_URL` و `NEXT_PUBLIC_BASE_URL` را با هم به‌روز کنید.

## نشانی‌های مهم

| نشانی | توضیح |
|---|---|
| `/dashboard` | داشبورد مدیریت |
| `/setup` | جادوگر تنظیم اولیه (فقط تا وقتی رمزی ذخیره نشده) |
| `/login` | ورود |
| `/v1/...` | نقطهٔ پایانی سازگار با `OpenAI` |
| `/v1beta/...` | نقطهٔ پایانی سازگار با `Gemini` |
| `/api/health` | بررسی سلامت (عمومی) |

## به‌روزرسانی

سه راه وجود دارد و هر سه به یک جا می‌رسند:

```bash
# ۱. اجرای دوبارهٔ اسکریپت نصب (fetch + reset --hard + build + restart)
curl -fsSL https://raw.githubusercontent.com/IRNova/NovaRoute/main/install.sh | sudo bash

# ۲. دستی
cd /opt/novaroute && git pull && npm install --omit=dev && npm run build && systemctl restart novaroute

# ۳. از داشبورد: Settings > System & Update
```

> هشدار: مسیر شمارهٔ ۱ داخل خودش `git reset --hard` دارد. هر تغییری که مستقیم روی فایل‌های `/opt/novaroute` داده باشید از بین می‌رود. تنظیمات شما در `.env` و پایگاه‌داده هستند و امن می‌مانند.

## حذف نصب

```bash
sudo bash /opt/novaroute/scripts/uninstall.sh
```

## عیب‌یابی نصب

| نشانه | علت محتمل | راه‌حل |
|---|---|---|
| سرویس بالا نمی‌آید | خطای ساخت یا کمبود حافظه | `journalctl -u novaroute -n 100` |
| صفحهٔ ورود بعد از رمز درست دوباره باز می‌شود | کوکی `Secure` روی `HTTP` ساده | `AUTH_COOKIE_SECURE=false` یا راه‌اندازی `TLS` |
| `better-sqlite3` نصب نشد | نبود ابزار کامپایل | مشکلی نیست؛ درایور به `node:sqlite` یا `sql.js` برمی‌گردد |
| کلاینت خطای ۴۰۱ می‌گیرد | دروازه کلید می‌خواهد | در `Dashboard > API Keys` کلید بسازید |

</div>
