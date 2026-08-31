"use client";

import { useState, useEffect } from "react";
import { DEFAULT_LOCALE, isRtlLocale, LOCALE_COOKIE } from "@/i18n/config";

const L = {
  en: {
    dir: "ltr",
    theme: "Toggle theme",
    intro:
      "Welcome to NovaRoute. This panel has not been configured yet. Set an admin password, pick a language and a theme, then get started.",
    brand: "First-time setup",
    s1t: "Admin password",
    s2desc:
      "Choose a password for the dashboard. You will use it every time you sign in.",
    pwlbl: "New password",
    pw2lbl: "Repeat password",
    pwbtn: "Create password & sign in",
    pwshort: "Password must be at least 6 characters.",
    pwmismatch: "Passwords do not match.",
    pwsaved: "Password created.",
    initlbl: "Initial password (from the installer)",
    inithint:
      "This panel is being set up from another machine, so it needs the initial password the installer printed (INITIAL_PASSWORD in the .env file).",
    pwerr: "Could not save the password.",
    pwwait: "Saving…",
    signing: "Signing in…",
    foot: "NovaRoute, open-source AI gateway",
  },
  fa: {
    dir: "rtl",
    theme: "تغییر پوسته",
    intro:
      "به NovaRoute خوش آمدید. این پنل هنوز تنظیم نشده است. یک رمز مدیریت بسازید، زبان و پوسته را انتخاب کنید و شروع کنید.",
    brand: "تنظیم اولیه",
    s1t: "رمز مدیریت",
    s2desc:
      "یک رمز برای ورود به داشبورد انتخاب کنید. هر بار با همین رمز وارد خواهید شد.",
    pwlbl: "رمز جدید",
    pw2lbl: "تکرار رمز",
    pwbtn: "ساخت رمز و ورود",
    pwshort: "رمز باید حداقل ۶ کاراکتر باشد.",
    pwmismatch: "دو رمز یکسان نیستند.",
    pwsaved: "رمز ساخته شد.",
    initlbl: "رمز اولیه (از خروجی نصب‌کننده)",
    inithint:
      "این پنل از یک دستگاه دیگر در حال تنظیم است، پس رمز اولیه‌ای که نصب‌کننده نشان داده لازم است (مقدار INITIAL_PASSWORD در فایل .env).",
    pwerr: "خطا در ذخیره رمز.",
    pwwait: "در حال ذخیره…",
    signing: "در حال ورود…",
    foot: "NovaRoute، دروازه‌ی هوش مصنوعی متن‌باز",
  },
  ru: {
    dir: "ltr",
    theme: "Переключить тему",
    intro:
      "Добро пожаловать в NovaRoute. Эта панель ещё не настроена. Задайте пароль администратора, выберите язык и тему и начните работу.",
    brand: "Начальная настройка",
    s1t: "Пароль администратора",
    s2desc:
      "Выберите пароль для панели. Он потребуется при каждом входе.",
    pwlbl: "Новый пароль",
    pw2lbl: "Повтор пароля",
    pwbtn: "Создать пароль и войти",
    pwshort: "Пароль должен быть не короче 6 символов.",
    pwmismatch: "Пароли не совпадают.",
    pwsaved: "Пароль создан.",
    initlbl: "Начальный пароль (из установщика)",
    inithint:
      "Панель настраивается с другого компьютера, поэтому нужен начальный пароль из установщика (INITIAL_PASSWORD в файле .env).",
    pwerr: "Не удалось сохранить пароль.",
    pwwait: "Сохранение…",
    signing: "Вход…",
    foot: "NovaRoute, сетевые инструменты с открытым кодом",
  },
};

const CSS = `
.nova-setup{color:var(--tx);font-family:'Vazirmatn','Inter',system-ui,Tahoma,sans-serif;min-height:100vh;padding:32px 16px;font-size:14px;background:radial-gradient(800px 420px at 50% -6%,color-mix(in srgb,var(--ac) 14%,transparent),transparent 60%),var(--bg)}
.nova-setup *{box-sizing:border-box;margin:0;padding:0}
.nova-setup .wrap{max-width:560px;margin:0 auto}
.nova-setup .bar{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
.nova-setup .brand{display:flex;align-items:center;gap:11px}
.nova-setup .brand .lg{width:40px;height:40px;border-radius:11px;background:var(--c2);border:1px solid var(--bd);display:flex;align-items:center;justify-content:center;overflow:hidden}
.nova-setup .brand .lg img{width:30px;height:30px;object-fit:contain;display:block}
.nova-setup .brand h1{font-size:19px;font-weight:800}
.nova-setup .tools{display:flex;gap:8px;align-items:center}
.nova-setup .lang{display:flex;gap:3px;background:var(--card);border:1px solid var(--bd);border-radius:10px;padding:3px}
.nova-setup .lang button{border:none;background:transparent;color:var(--mu);font:inherit;font-size:12px;font-weight:600;padding:5px 12px;border-radius:7px;cursor:pointer}
.nova-setup .lang button.on{background:var(--color-primary);color:var(--on-primary)}
.nova-setup .tbtn{width:38px;height:32px;background:var(--card);border:1px solid var(--bd);border-radius:10px;color:var(--tx2);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:15px}
.nova-setup .tbtn:hover{color:var(--ac);border-color:var(--bd2)}
.nova-setup .intro{color:var(--mu);font-size:13.5px;line-height:1.9;margin:14px 0 22px}
.nova-setup .card{background:var(--card);border:1px solid var(--bd);border-radius:16px;padding:20px 22px;margin-bottom:16px;box-shadow:var(--shadow)}
.nova-setup .ch{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}
.nova-setup .ch .t{font-size:15px;font-weight:700;display:flex;align-items:center;gap:9px}
.nova-setup .num{width:26px;height:26px;border-radius:8px;background:var(--c2);border:1px solid var(--bd);display:inline-flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:var(--ac)}
.nova-setup .desc{color:var(--tx2);font-size:13.5px;line-height:1.9;margin-bottom:12px}
.nova-setup .field{margin-bottom:11px}
.nova-setup .field label{display:block;font-size:12px;font-weight:600;color:var(--tx2);margin-bottom:5px}
.nova-setup .field input{width:100%;background:var(--c2);border:1px solid var(--bd2);border-radius:10px;color:var(--tx);font:inherit;font-size:14px;padding:11px 13px;outline:none;transition:.12s}
.nova-setup .field input:focus{border-color:var(--ac);box-shadow:0 0 0 3px var(--ring)}
.nova-setup .btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;border:1px solid var(--bd2);background:var(--c2);color:var(--tx);font:inherit;font-weight:600;font-size:13px;padding:9px 18px;border-radius:10px;cursor:pointer;transition:.12s}
.nova-setup .btn:hover{border-color:var(--ac);color:var(--ac)}
.nova-setup .btn.p{background:var(--grad);color:var(--on-accent);border:none;box-shadow:var(--shadow-accent)}
.nova-setup .btn.p:hover{filter:brightness(1.06)}
.nova-setup .btn:disabled{opacity:.45;cursor:not-allowed;filter:none;border-color:var(--bd2);color:var(--mu)}
.nova-setup .hint{font-size:11.5px;line-height:1.7;color:var(--tx2);margin-top:6px}
.nova-setup .msg{font-size:12.5px;font-weight:600;margin-top:4px;min-height:16px}
.nova-setup .msg.ok{color:var(--ok)}.nova-setup .msg.bad{color:var(--dg)}
.nova-setup .foot{text-align:center;color:var(--mu);font-size:11.5px;margin-top:18px}
@media (max-width:560px){
 .nova-setup .field input{font-size:16px;padding:13px}
 .nova-setup .btn{min-height:44px;padding:11px 18px}
 .nova-setup .lang button{min-height:40px}
 .nova-setup .tbtn{height:40px;width:40px}
 .nova-setup body{padding:24px 14px}
 .nova-setup .card{padding:18px 16px}
}
`;

function getCookieLocale() {
  if (typeof document === "undefined") return DEFAULT_LOCALE;
  const m = document.cookie.split(";").find((c) => c.trim().startsWith(`${LOCALE_COOKIE}=`));
  return m ? decodeURIComponent(m.split("=")[1]) : DEFAULT_LOCALE;
}

export default function SetupPage() {
  const [lang, setLang] = useState("fa");
  const [dark, setDark] = useState(false);
  const [status, setStatus] = useState("loading"); // "loading" | "ready" | "done"
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [msg, setMsg] = useState({ text: "", type: "" });
  const [saving, setSaving] = useState(false);
  // Set when the server answers that a remote claim needs the initial password.
  const [needsInitial, setNeedsInitial] = useState(false);
  const [initialPw, setInitialPw] = useState("");

  const t = L[lang] || L.fa;

  useEffect(() => {
    setDark(typeof document !== "undefined" && document.documentElement.classList.contains("dark"));
    const loc = getCookieLocale();
    setLang(L[loc] ? loc : "fa");
  }, []);

  useEffect(() => {
    const dir = isRtlLocale(lang) ? "rtl" : "ltr";
    document.documentElement.dir = dir;
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/status");
        if (!res.ok) {
          setStatus("ready");
          return;
        }
        const data = await res.json();
        if (data.hasPassword) {
          // Already configured → normal flow
          window.location.assign(data.authenticated ? "/dashboard" : "/login");
          return;
        }
        setStatus("ready");
      } catch {
        setStatus("ready");
      }
    })();
  }, []);

  const switchLang = async (code) => {
    setLang(code);
    try {
      await fetch("/api/locale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: code }),
      });
    } catch { /* best-effort */ }
  };

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch { /* ignore */ }
    document.documentElement.classList.toggle("dark", next);
  };

  const save = async (e) => {
    e.preventDefault();
    setMsg({ text: "", type: "" });
    if (pw.length < 6) {
      setMsg({ text: t.pwshort, type: "bad" });
      return;
    }
    if (pw !== pw2) {
      setMsg({ text: t.pwmismatch, type: "bad" });
      return;
    }
    setSaving(true);
    setMsg({ text: t.pwwait, type: "" });
    try {
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newPassword: pw,
          locale: lang,
          ...(initialPw ? { currentPassword: initialPw } : {}),
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        if (j.code === "setup_requires_initial_password") setNeedsInitial(true);
        setMsg({ text: j.error || t.pwerr, type: "bad" });
        setSaving(false);
        return;
      }
      setMsg({ text: t.pwsaved, type: "ok" });
      // Auto sign-in with the new password
      const loginRes = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw }),
      });
      setStatus("done");
      if (loginRes.ok) {
        window.location.assign("/dashboard");
      } else {
        window.location.assign("/login");
      }
    } catch {
      setMsg({ text: t.pwerr, type: "bad" });
      setSaving(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="nova-setup flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="nova-setup">
      <style>{CSS}</style>
      <div className="wrap">
        <div className="bar">
          <div className="brand">
            <span className="lg"><img src="/logo-mark.svg" alt="Nova" /></span>
            <h1>NovaRoute</h1>
          </div>
          <div className="tools">
            <div className="lang">
              {["fa", "en", "ru"].map((code) => (
                <button key={code} className={lang === code ? "on" : ""} onClick={() => switchLang(code)}>
                  {code === "fa" ? "فا" : code === "en" ? "EN" : "РУ"}
                </button>
              ))}
            </div>
            <button className="tbtn" title={t.theme} aria-label={t.theme} onClick={toggleTheme}>
              {dark ? "☀" : "☾"}
            </button>
          </div>
        </div>

        <p className="intro">{t.intro}</p>

        <div className="card">
          <div className="ch">
            <div className="t">
              <span className="num">1</span>
              <span>{t.brand} — {t.s1t}</span>
            </div>
          </div>
          <p className="desc">{t.s2desc}</p>
          <form onSubmit={save}>
            <div className="field">
              <label htmlFor="pw">{t.pwlbl}</label>
              <input
                id="pw"
                type="password"
                autoComplete="new-password"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                autoFocus
              />
            </div>
            <div className="field">
              <label htmlFor="pw2">{t.pw2lbl}</label>
              <input
                id="pw2"
                type="password"
                autoComplete="new-password"
                value={pw2}
                onChange={(e) => setPw2(e.target.value)}
              />
            </div>
            {needsInitial && (
              <div className="field">
                <label htmlFor="initpw">{t.initlbl}</label>
                <input
                  id="initpw"
                  type="password"
                  autoComplete="off"
                  value={initialPw}
                  onChange={(e) => setInitialPw(e.target.value)}
                />
                <p className="hint">{t.inithint}</p>
              </div>
            )}
            <button className="btn p" type="submit" disabled={saving || status === "done"}>
              {status === "done" ? t.signing : t.pwbtn}
            </button>
            <div className={`msg${msg.type ? ` ${msg.type}` : ""}`} role="alert" aria-live="assertive">
              {msg.text}
            </div>
          </form>
        </div>

        <div className="foot">{t.ft}</div>
      </div>
    </div>
  );
}
