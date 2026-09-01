"use client";

import { useState, useEffect, useCallback } from "react";
import { DEFAULT_LOCALE, isRtlLocale, LOCALE_COOKIE } from "@/i18n/config";

/* Bilingual UI strings — mirrors nova-panel.github.io-main login page */
const L = {
  en: {
    dir: "ltr",
    theme: "Toggle theme",
    showpw: "Show password",
    hidepw: "Hide password",
    t1: "Sign in to the admin panel",
    lpw: "Password",
    pw: "password",
    go: "Login",
    bad: "Wrong password",
    forgot: "Forgot password?",
    forgotb:
      "Manual fallback: reset to default via the NovaRoute CLI → Settings → Reset Password to Default.",
    ft: "NovaRoute, open-source AI gateway",
    oidc: "Sign in with OIDC",
  },
  fa: {
    dir: "rtl",
    theme: "تغییر پوسته",
    showpw: "نمایش رمز",
    hidepw: "پنهان کردن رمز",
    t1: "ورود به پنل مدیریت",
    lpw: "رمز عبور",
    pw: "رمز عبور",
    go: "ورود",
    bad: "رمز اشتباه است",
    forgot: "رمز را فراموش کردید؟",
    forgotb:
      "راه دستی: از طریق CLI نوا‌روت رمز را به حالت پیش‌فرض برگردانید → Settings → Reset Password to Default.",
    ft: "NovaRoute، دروازه‌ی هوش مصنوعی متن‌باز",
    oidc: "ورود با OIDC",
  },
  ru: {
    dir: "ltr",
    theme: "Переключить тему",
    showpw: "Показать пароль",
    hidepw: "Скрыть пароль",
    t1: "Вход в панель администратора",
    lpw: "Пароль",
    pw: "пароль",
    go: "Войти",
    bad: "Неверный пароль",
    forgot: "Забыли пароль?",
    forgotb:
      "Резервный способ: сбросьте пароль через NovaRoute CLI → Settings → Reset Password to Default.",
    ft: "NovaRoute, сетевые инструменты с открытым кодом",
    oidc: "Войти через OIDC",
  },
};

const CSS = `
.nova-auth{--bg:var(--bg);color:var(--tx);font-family:'Vazirmatn','Inter',system-ui,Tahoma,sans-serif}
.nova-auth *{box-sizing:border-box;margin:0;padding:0}
.nova-auth .box{width:100%;max-width:392px}
.nova-auth .bar{display:flex;align-items:center;justify-content:space-between;margin-bottom:18px}
.nova-auth .brand{display:flex;align-items:center;gap:11px}
.nova-auth .brand .lg{width:40px;height:40px;border-radius:11px;background:var(--c2);border:1px solid var(--bd);display:flex;align-items:center;justify-content:center;overflow:hidden}
.nova-auth .brand .lg img{width:30px;height:30px;object-fit:contain;display:block}
.nova-auth .brand h1{font-size:19px;font-weight:800;letter-spacing:-.3px}
.nova-auth .tools{display:flex;gap:8px;align-items:center}
.nova-auth .lang{display:flex;gap:3px;background:var(--card);border:1px solid var(--bd);border-radius:10px;padding:3px}
.nova-auth .lang button{border:none;background:transparent;color:var(--mu);font:inherit;font-size:12px;font-weight:600;padding:5px 12px;border-radius:7px;cursor:pointer}
.nova-auth .lang button.on{background:var(--color-primary);color:var(--on-primary)}
.nova-auth .tbtn{width:40px;height:34px;background:var(--card);border:1px solid var(--bd);border-radius:10px;color:var(--tx2);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:15px;line-height:1}
.nova-auth .tbtn:hover{color:var(--ac);border-color:var(--bd2)}
.nova-auth .card{background:var(--card);border:1px solid var(--bd);border-radius:16px;padding:26px 24px;box-shadow:var(--shadow)}
.nova-auth .t{font-size:11px;color:var(--mu);text-transform:uppercase;letter-spacing:1.4px;font-weight:700;margin-bottom:16px}
.nova-auth label{display:block;font-size:12px;color:var(--tx2);font-weight:500;margin-bottom:7px}
.nova-auth input{width:100%;background:var(--c2);border:1px solid var(--bd2);border-radius:11px;padding:13px 14px;color:var(--tx);font-size:14px;font-family:inherit;outline:none;transition:.12s}
.nova-auth input:focus{border-color:var(--ac);box-shadow:0 0 0 3px var(--ring)}
.nova-auth .pwwrap{position:relative}
.nova-auth .pwwrap input{padding-right:46px}
[dir="rtl"] .nova-auth .pwwrap input{padding-right:14px;padding-left:46px}
.nova-auth .peek{position:absolute;top:0;bottom:0;right:6px;margin:auto;width:32px;height:32px;display:flex;align-items:center;justify-content:center;background:transparent;border:none;color:var(--mu);cursor:pointer;padding:0;border-radius:8px;transition:.12s}
[dir="rtl"] .nova-auth .peek{right:auto;left:6px}
.nova-auth .peek:hover{color:var(--ac)}
.nova-auth .peek svg{width:19px;height:19px;display:block}
.nova-auth .peek .off{display:none}.nova-auth .peek.on .on{display:none}.nova-auth .peek.on .off{display:block}
.nova-auth button.go{width:100%;margin-top:16px;padding:13px;border:none;border-radius:var(--radius-brand);background:var(--grad);color:var(--on-accent);box-shadow:var(--shadow-accent);font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;transition:.12s}
.nova-auth button.go:hover{filter:brightness(1.05)}
.nova-auth button.go:disabled{opacity:.6;cursor:default}
.nova-auth .err{color:var(--dg);font-size:13px;margin-top:13px}
.nova-auth details{margin-top:12px}
.nova-auth summary{color:var(--mu);font-size:12.5px;cursor:pointer;list-style:none}
.nova-auth summary::-webkit-details-marker{display:none}
.nova-auth .rec-box{display:flex;flex-direction:column;gap:8px;margin-top:10px}
.nova-auth .rec-msg{font-size:11.5px;color:var(--tx2);line-height:1.5}
.nova-auth .social{display:flex;gap:9px;margin-top:18px}
.nova-auth .social a{flex:1;display:flex;align-items:center;justify-content:center;gap:8px;height:42px;background:var(--card);border:1px solid var(--bd);border-radius:11px;color:var(--tx);text-decoration:none;font-size:12.5px;font-weight:600;transition:transform .13s,border-color .13s,box-shadow .13s}
.nova-auth .social a:hover{border-color:var(--bd2);transform:translateY(-1px);box-shadow:0 7px 18px rgba(40,60,110,.12)}
.dark .nova-auth .social a:hover{box-shadow:0 8px 20px rgba(0,0,0,.45)}
.nova-auth .social a svg{width:20px;height:20px;flex-shrink:0}
.nova-auth .social a .wb{color:var(--ac)}
.nova-auth .social a .tg{color:#229ED9}
.nova-auth .social a .yt{color:#FF0000}
.nova-auth .social a .ig{color:#E1306C}
.nova-auth .foot{text-align:center;color:var(--mu);font-size:11.5px;margin-top:18px}
.nova-auth .oidc-btn{width:100%;padding:11px;border:1px solid var(--bd2);background:transparent;color:var(--tx);border-radius:11px;font:inherit;font-size:13px;font-weight:600;cursor:pointer;transition:.12s;margin-top:16px}
.nova-auth .oidc-btn:hover{border-color:var(--ac);color:var(--ac)}
.nova-auth .sep{display:flex;align-items:center;gap:8px;color:var(--mu);font-size:10.5px;margin:14px 0 0}
.nova-auth .sep::before,.nova-auth .sep::after{content:"";flex:1;height:1px;background:var(--bd)}
.nova-auth .note{font-size:11px;color:var(--mu);text-align:center;margin-top:14px;line-height:1.6}
.nova-auth .note b{font-weight:600}
@media (max-width:560px){
 .nova-auth input{font-size:16px;padding:14px}
 .nova-auth button.go{padding:15px}
 .nova-auth .social a{height:46px}
 .nova-auth .lang button{min-height:40px}
 .nova-auth .tbtn{height:40px;min-width:40px}
 .nova-auth .card{padding:24px 18px}
}
`;

function peekOnIcon() {
  return (
    <svg className="on" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>
  );
}
function peekOffIcon() {
  return (
    <svg className="off" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
  );
}

function getCookieLocale() {
  if (typeof document === "undefined") return DEFAULT_LOCALE;
  const m = document.cookie.split(";").find((c) => c.trim().startsWith(`${LOCALE_COOKIE}=`));
  return m ? decodeURIComponent(m.split("=")[1]) : DEFAULT_LOCALE;
}

export default function LoginPage() {
  const [lang, setLang] = useState("fa");
  const [dark, setDark] = useState(false);
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [resetHint, setResetHint] = useState("");
  const [retryAfter, setRetryAfter] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasPassword, setHasPassword] = useState(null);
  const [authMode, setAuthMode] = useState("password");
  const [oidcConfigured, setOidcConfigured] = useState(false);
  const [oidcLoginLabel, setOidcLoginLabel] = useState(L.en.oidc);
  const [mustChange, setMustChange] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [twoFaPreToken, setTwoFaPreToken] = useState(null);
  const [totpCode, setTotpCode] = useState("");

  const handleVerify2fa = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login/2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preToken: twoFaPreToken, code: totpCode }),
      });
      if (res.ok) {
        window.location.assign("/dashboard");
      } else {
        const data = await res.json();
        setError(data.error || "Invalid code");
      }
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const t = L[lang] || L.fa;

  // Countdown for rate-limit
  useEffect(() => {
    if (retryAfter <= 0) return;
    const id = setInterval(() => setRetryAfter((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [retryAfter]);

  // Init theme + language from persisted state
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

  const checkAuth = useCallback(async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    try {
      const res = await fetch(`${baseUrl}/api/auth/status`, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        if (data.authenticated === true || data.requireLogin === false) {
          window.location.assign("/dashboard");
          return;
        }
        if (!data.hasPassword && (data.authMode !== "oidc" || data.oidcConfigured !== true)) {
          // First run — no admin password set yet, take the user to initial setup
          window.location.assign("/setup");
          return;
        }
        setHasPassword(!!data.hasPassword);
        setAuthMode(data.authMode || "password");
        setOidcConfigured(data.oidcConfigured === true);
        setOidcLoginLabel(data.oidcLoginLabel || L.en.oidc);
      } else {
        setHasPassword(true);
      }
    } catch {
      clearTimeout(timeoutId);
      setHasPassword(true);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const switchLang = async (code) => {
    setLang(code);
    try {
      await fetch("/api/locale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: code }),
      });
    } catch {
      /* cookie is best-effort */
    }
  };

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch { /* ignore */ }
    document.documentElement.classList.toggle("dark", next);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResetHint("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.mustChangePassword) {
          setMustChange(true);
          return;
        }
        if (data.requiresTwoFactor && data.preToken) {
          setTwoFaPreToken(data.preToken);
          setError("");
          return;
        }
        window.location.assign("/dashboard");
      } else {
        const data = await res.json();
        setError(data.error || t.bad);
        if (data.resetHint) setResetHint(data.resetHint);
        if (data.retryAfter) setRetryAfter(Number(data.retryAfter));
      }
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSetNewPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: pw, newPassword }),
      });
      if (res.ok) {
        window.location.assign("/dashboard");
      } else {
        const data = await res.json();
        setError(data.error || "Failed to set password");
      }
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleOidcLogin = () => {
    window.location.href = "/api/auth/oidc/start";
  };

  const oidcAvailable = oidcConfigured && ["oidc", "both"].includes(authMode);
  const passwordAvailable = authMode !== "oidc" || !oidcConfigured;

  if (hasPassword === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-nova-auth p-4">
        <div className="text-center">
          <div className="mx-auto mb-6 flex items-center justify-center size-16 rounded-2xl bg-nova-gradient shadow-[var(--shadow-accent)]">
            <img src="/logo-mark-mono.svg" alt="NovaRoute" className="size-10 object-contain" />
          </div>
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="text-text-muted mt-4">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="nova-auth min-h-screen flex items-center justify-center p-5 bg-nova-auth">
      <style>{CSS}</style>
      <div className="box">
        <div className="bar">
          <div className="brand">
            <span className="lg"><img src="/logo-mark.svg" alt="Nova" /></span>
            <h1>NovaRoute</h1>
          </div>
          <div className="tools">
            <div className="lang">
              {["fa", "en", "ru"].map((code) => (
                <button key={code} data-l={code} className={lang === code ? "on" : ""} onClick={() => switchLang(code)}>
                  {code === "fa" ? "فا" : code === "en" ? "EN" : "РУ"}
                </button>
              ))}
            </div>
            <button className="tbtn" title={t.theme} aria-label={t.theme} onClick={toggleTheme}>
              {dark ? "☀" : "☾"}
            </button>
          </div>
        </div>

        {twoFaPreToken ? (
            <form onSubmit={handleVerify2fa}>
              <div className="t">{t.t1}</div>
              <p className="note">Enter the 6-digit code from your authenticator app.</p>
              <label>Authentication code</label>
              <input
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="000000"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))}
                autoFocus
                dir="ltr"
                style={{ letterSpacing: "0.4em", textAlign: "center" }}
              />
              {error && <div className="err">{error}</div>}
              <button className="go" type="submit" disabled={loading || totpCode.length !== 6}>
                Verify
              </button>
              <button
                className="go"
                type="button"
                style={{ background: "transparent", color: "var(--mu)" }}
                onClick={() => {
                  setTwoFaPreToken(null);
                  setTotpCode("");
                  setError("");
                }}
              >
                Back
              </button>
            </form>
          ) : mustChange ? (
            <form onSubmit={handleSetNewPassword}>
              <div className="t">{t.t1}</div>
              <p className="note" style={{ color: "var(--dg)" }}>
                Set a new password before accessing the dashboard remotely.
              </p>
              <label>New password</label>
              <input
                type="password"
                placeholder="Enter new password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoFocus
              />
              {error && <div className="err">{error}</div>}
              <button className="go" type="submit" disabled={loading || !newPassword}>
                Set password
              </button>
            </form>
          ) : (
            <>
              <div className="t">{t.t1}</div>

              {oidcAvailable && (
                <button className="oidc-btn" type="button" onClick={handleOidcLogin}>
                  {oidcLoginLabel}
                </button>
              )}
              {oidcAvailable && passwordAvailable && <div className="sep" />}

              {passwordAvailable ? (
                <form onSubmit={handleLogin}>
                  <label htmlFor="pw">{t.lpw}</label>
                  <div className="pwwrap">
                    <input
                      id="pw"
                      type={show ? "text" : "password"}
                      placeholder={t.pw}
                      autoComplete="current-password"
                      value={pw}
                      onChange={(e) => setPw(e.target.value)}
                      autoFocus={!oidcAvailable}
                    />
                    <button
                      type="button"
                      className={`peek${show ? " on" : ""}`}
                      aria-label={show ? t.hidepw : t.showpw}
                      onClick={() => setShow((s) => !s)}
                    >
                      {peekOnIcon()}
                      {peekOffIcon()}
                    </button>
                  </div>

                  {error && <div className="err">{error}</div>}
                  {retryAfter > 0 && (
                    <div className="err">
                      Locked. Retry in <b>{retryAfter}s</b>.
                    </div>
                  )}

                  <button className="go" type="submit" disabled={loading || retryAfter > 0}>
                    {retryAfter > 0 ? `Wait ${retryAfter}s` : t.go}
                  </button>

                  <details>
                    <summary>{t.forgot}</summary>
                    <div className="rec-box">
                      <div className="rec-msg">
                        {resetHint || t.forgotb}
                      </div>
                    </div>
                  </details>
                </form>
              ) : (
                error && <div className="err">{error}</div>
              )}
            </>
          )}

        <div className="social">
          <a href="https://novaproxy.online" target="_blank" rel="noopener" title="Web" aria-label="Web">
            <svg className="wb" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
          </a>
          <a href="https://t.me/irnova" target="_blank" rel="noopener" title="Telegram" aria-label="Telegram">
            <svg className="tg" viewBox="0 0 24 24" fill="currentColor"><path d="M21.94 4.6 18.9 19.2c-.23 1.01-.83 1.26-1.68.78l-4.64-3.42-2.24 2.16c-.25.25-.46.46-.94.46l.33-4.73 8.6-7.77c.37-.33-.08-.52-.58-.19l-10.63 6.7-4.58-1.43c-1-.31-1.01-1 .21-1.48l17.9-6.9c.83-.31 1.56.19 1.29 1.45z"/></svg>
          </a>
          <a href="https://www.youtube.com/@novaproxyir" target="_blank" rel="noopener" title="YouTube" aria-label="YouTube">
            <svg className="yt" viewBox="0 0 24 24" fill="currentColor"><path d="M23 12s0-3.2-.4-4.7a2.5 2.5 0 0 0-1.76-1.77C19.34 5.13 12 5.13 12 5.13s-7.34 0-8.84.4A2.5 2.5 0 0 0 1.4 7.3C1 8.8 1 12 1 12s0 3.2.4 4.7a2.5 2.5 0 0 0 1.76 1.77c1.5.4 8.84.4 8.84.4s7.34 0 8.84-.4a2.5 2.5 0 0 0 1.76-1.77C23 15.2 23 12 23 12zM9.75 15.5v-7l6.25 3.5-6.25 3.5z"/></svg>
          </a>
          <a href="https://www.instagram.com/irnova_team" target="_blank" rel="noopener" title="Instagram" aria-label="Instagram">
            <svg className="ig" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c2.717 0 3.056.01 4.122.06 1.065.05 1.79.217 2.428.465.66.254 1.216.598 1.772 1.153.509.5.902 1.105 1.153 1.772.247.637.415 1.363.465 2.428.047 1.066.06 1.405.06 4.122 0 2.717-.01 3.056-.06 4.122-.05 1.065-.218 1.79-.465 2.428a4.883 4.883 0 0 1-1.153 1.772c-.5.508-1.105.902-1.772 1.153-.637.247-1.363.415-2.428.465-1.066.047-1.405.06-4.122.06-2.717 0-3.056-.01-4.122-.06-1.065-.05-1.79-.218-2.428-.465a4.89 4.89 0 0 1-1.772-1.153 4.904 4.904 0 0 1-1.153-1.772c-.248-.637-.415-1.363-.465-2.428C2.013 15.056 2 14.717 2 12c0-2.717.01-3.056.06-4.122.05-1.066.217-1.79.465-2.428a4.88 4.88 0 0 1 1.153-1.772A4.897 4.897 0 0 1 5.45 2.525c.638-.248 1.362-.415 2.428-.465C8.944 2.013 9.283 2 12 2zm0 5a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm6.5-.25a1.25 1.25 0 1 0-2.5 0 1.25 1.25 0 0 0 2.5 0zM12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6z"/></svg>
          </a>
        </div>

        <div className="foot">{t.ft}</div>
      </div>
    </div>
  );
}
