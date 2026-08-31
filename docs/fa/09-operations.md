<div dir="rtl">

# ۹. بهره‌برداری

## سرویس

```bash
systemctl status novaroute
systemctl restart novaroute
systemctl stop novaroute
journalctl -u novaroute -f              # لاگ زنده
journalctl -u novaroute -n 200 --no-pager
journalctl -u novaroute --since "1 hour ago" | grep -Ei "error|fail"
```

فایل سرویس در `/etc/systemd/system/novaroute.service` است و متغیرها را از `INSTALL_DIR/.env` می‌خواند. بعد از تغییر `.env` حتماً `systemctl restart novaroute` بزنید؛ `reload` کافی نیست.

## لاگ‌ها

| منبع | محل |
|---|---|
| لاگ فرایند | `journalctl -u novaroute` |
| آمار مصرف | `DATA_DIR/usage.json` |
| لاگ متنی قدیمی | `DATA_DIR/log.txt` |
| جزئیات درخواست‌ها | جدول `requestDetails` در پایگاه‌داده (فقط وقتی رصدپذیری روشن باشد) |

توجه: `usage.json` و `log.txt` از `DATA_DIR` تبعیت نمی‌کنند و همیشه زیر `~/.novaroute` نوشته می‌شوند. اگر سرویس با کاربر `root` اجرا می‌شود یعنی `/root/.novaroute`.

## پشتیبان‌گیری

پشتیبان روزانه داخل خود برنامه اجرا می‌شود (نه `cron`): ۴۵ ثانیه پس از بالا آمدن و بعد هر ۲۴ ساعت، و هفت نسخهٔ آخر نگه داشته می‌شود.

```
DATA_DIR/db/backups/daily-<تاریخ>/data.sqlite
```

پیش از هر مهاجرت شِما هم یک پشتیبان جداگانه گرفته می‌شود.

**پشتیبان‌گیری دستی:**

```bash
systemctl stop novaroute
cp -a /var/lib/novaroute/db/data.sqlite /backup/novaroute-$(date +%F).sqlite
cp -a /opt/novaroute/.env /backup/novaroute-$(date +%F).env
systemctl start novaroute
```

> فایل پشتیبان همهٔ اعتبارنامه‌ها را دارد. اگر `API_KEY_SECRET` تنظیم نکرده باشید، این‌ها متن ساده‌اند. پشتیبان را رمزگذاری‌شده و بیرون از سرور نگه دارید.

**بازیابی:** از داشبورد (`Settings > Database`) یا با جایگزینی فایل هنگام خاموش بودن سرویس. بازیابی از داشبورد پیش از هر کار یک عکس `pre-restore` می‌گیرد.

## پایش

```bash
curl -s localhost:20126/api/health          # سلامت پایه
curl -s localhost:20126/api/public-status   # زمان کارکرد و تعداد اتصال فعال
node scripts/nova-doctor.mjs --db           # بررسی نحوی، جدول‌ها، درایور، متغیرها
node scripts/nova-security-audit.mjs --fa   # وضعیت امنیتی
```

هنوز نقطهٔ پایانی `Prometheus` وجود ندارد؛ در [نقشهٔ راه](07-roadmap.md) آمده است.

## رفع اشکال متداول

**«ورود می‌کنم ولی دوباره به صفحهٔ ورود برمی‌گردم.»**
کوکی `Secure` روی `HTTP` ساده. یا `TLS` راه بیندازید یا `AUTH_COOKIE_SECURE=false` بگذارید.

**«رمز را فراموش کرده‌ام.»**
مسیر `‎/api/auth/reset-password` رمز ذخیره‌شده را پاک می‌کند تا دوباره `INITIAL_PASSWORD` معتبر شود، ولی عمداً هم «محلی» می‌خواهد و هم احراز هویت؛ یعنی با `curl` خالی باز نمی‌شود. دو راه دارید:

۱. ابزار `CLI` روی همان ماشین (توکن دستگاه را خودش می‌فرستد):

```bash
npx novaroute        # سپس: Settings → Reset Password to Default
```

۲. رمز اضطراری: مقدار `ADMIN_MASTER_PASSWORD` را موقتاً در `.env` بگذارید، سرویس را ری‌استارت کنید، وارد شوید، رمز تازه بسازید و بعد آن خط را حذف و دوباره ری‌استارت کنید.

**«کلاینت خطای ۴۰۱ می‌گیرد ولی قبلاً کار می‌کرد.»**
از این نسخه دروازه کلید می‌خواهد. در `Dashboard > API Keys` کلید بسازید. اگر عمداً می‌خواهید بدون کلید کار کند، `Require API Key` را خاموش کنید؛ در این حالت فقط شبکهٔ محلی و خصوصی پذیرفته می‌شود.

**«ارائه‌دهنده `429` یا `401` می‌دهد.»**
در صفحهٔ ارائه‌دهنده، وضعیت هر حساب را ببینید. برای `OAuth` معمولاً توکن منقضی شده و تازه‌سازی خودکار شکست خورده است؛ لاگ `journalctl` علت را می‌گوید.

**«پنل کند شده است.»**
جدول `requestDetails` بزرگ‌ترین جدول است. رصدپذیری را خاموش کنید یا سقف رکوردها را در تنظیمات کم کنید.

**«بعد از به‌روزرسانی سرویس بالا نمی‌آید.»**
ابتدا `journalctl -u novaroute -n 100`. اگر خطای مهاجرت است، پشتیبان پیش از مهاجرت در `DATA_DIR/db/backups/schema-*` هست.

## چرخاندن رازها

```bash
# کلید نشست: همهٔ کاربران باید دوباره وارد شوند
openssl rand -hex 32

# کلید رمزگذاری میدانی: پیش از تغییر باید مقادیر رمزشده را با کلید قبلی خواند
#   یعنی: با کلید قدیم بالا بیایید، اعتبارنامه‌ها را دوباره ذخیره کنید، بعد کلید را عوض کنید.
openssl rand -hex 24
```

اگر `API_KEY_SECRET` را بدون این ترتیب عوض کنید، اعتبارنامه‌های قدیمی خوانده نمی‌شوند و پنل به‌جای مقدار خراب، مقدار خالی نشان می‌دهد (این رفتار عمدی است تا چیز نادرستی به بالادست فرستاده نشود).

</div>
