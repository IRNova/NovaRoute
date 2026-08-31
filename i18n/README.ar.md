<div align="center">
<div align="right">
  <a href="../README.md">English</a> | <a href="../README.fa.md">فارسی</a>
</div>

<img src="../assets/readme/hero.svg" width="100%" alt="NovaRoute">

**NovaRoute – منصة مزودي الذكاء الاصطناعي المتقدمة والدردشة**

منصة قوية مستضافة محلياً لإدارة مزودي الذكاء الاصطناعي (API، CLI، OAuth، Cookie)، وبناء تركيبات النماذج، والدردشة مع جميع نماذجك في مكان واحد.

[![License](https://img.shields.io/badge/license-MIT-green?style=for-the-badge)](../LICENSE)
[![Version](https://img.shields.io/badge/version-1.0.0-blueviolet?style=for-the-badge)](https://github.com/IRNova/NovaRoute)
</div>

---

## 🚀 تثبيت بنقرة واحدة

قم بالتشغيل على خادم Linux جديد (Ubuntu/Debian أو RHEL/CentOS/Fedora أو متوافق):

```bash
curl -fsSL https://raw.githubusercontent.com/IRNova/NovaRoute/main/install.sh | sudo bash
```

سيقوم المثبت بـ:

1. تثبيت Node.js إذا كان مفقوداً.
2. استنساخ هذا المستودع إلى `/opt/novaroute`.
3. تثبيت التبعيات وبناء حزمة الإنتاج.
4. إنشاء مستخدم Linux معزول `novaroute` ودليل البيانات `/var/lib/novaroute`.
5. إنشاء ملف `.env` آمن بأسرار عشوائية.
6. تثبيت وبدء خدمة systemd تسمى `novaroute`.
7. تكوين جميع مزودي المجانية بدون مصادقة على لوحة التحكم تلقائياً.

المنفذ الافتراضي هو **20126**. سيطلب المثبت التأكيد أو التغيير.

بعد التثبيت، افتح لوحة التحكم:

```text
http://<server-ip>:20126/dashboard
```

---

## 🌐 API

NovaRoute يكشف نقطة نهاية متوافقة مع OpenAI على:

```text
http://<server-ip>:20126/v1
```

---

## 📄 الترخيص

NovaRoute يتم إصداره بموجب [MIT License](../LICENSE).
