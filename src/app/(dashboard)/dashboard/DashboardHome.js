"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { translate } from "@/i18n/runtime";
import SystemHealthModal from "./SystemHealthModal";

const CSS = `
.nova-dash{display:flex;flex-direction:column;gap:14px}
.nova-dash .hero{position:relative;overflow:hidden;border:1px solid color-mix(in srgb,var(--ac) 30%,var(--bd));background:linear-gradient(120deg,color-mix(in srgb,var(--ac) 10%,transparent),color-mix(in srgb,var(--ac2) 10%,transparent));border-radius:16px;padding:20px 22px;display:flex;align-items:center;gap:16px;flex-wrap:wrap}
.nova-dash .hero::after{content:"";position:absolute;inset-inline-end:-80px;top:-90px;width:260px;height:260px;border-radius:50%;background:radial-gradient(circle,color-mix(in srgb,var(--ac) 22%,transparent),transparent 65%);pointer-events:none}
.nova-dash .hero .h-ic{width:52px;height:52px;flex:0 0 52px;border-radius:14px;background:var(--grad);display:flex;align-items:center;justify-content:center;color:#fff;box-shadow:0 10px 24px -8px color-mix(in srgb,var(--ac) 60%,transparent)}
.nova-dash .hero .h-ic img{width:30px;height:30px;object-fit:contain;display:block}
.nova-dash .hero .h-t{flex:1;min-width:0}
.nova-dash .hero .h-lead{font-size:15px;font-weight:700;letter-spacing:-.2px;color:var(--tx)}
.nova-dash .hero p{font-size:12.5px;color:var(--tx2);margin-top:4px;line-height:1.6}
.nova-dash .hero .h-chip{display:inline-flex;align-items:center;gap:7px;font-size:11.5px;font-weight:700;padding:5px 12px;border-radius:999px;border:1px solid color-mix(in srgb,var(--ok) 35%,transparent);background:color-mix(in srgb,var(--ok) 12%,transparent);color:var(--ok);white-space:nowrap}
.nova-dash .hero .h-chip .d{width:7px;height:7px;border-radius:50%;background:var(--ok);box-shadow:0 0 0 3px color-mix(in srgb,var(--ok) 22%,transparent)}
.nova-dash .kpi-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px}
.nova-dash .kpi{background:var(--card);border:1px solid var(--bd);border-radius:14px;padding:15px 16px;box-shadow:var(--shadow);display:flex;flex-direction:column;gap:10px}
.nova-dash .kpi-top{display:flex;align-items:center;gap:11px}
.nova-dash .kpi-ic{width:38px;height:38px;flex:0 0 38px;border-radius:11px;background:color-mix(in srgb,var(--ac) 10%,transparent);color:var(--ac);display:flex;align-items:center;justify-content:center;font-size:19px}
.nova-dash .kpi-top .lbl{font-size:11px;color:var(--mu);text-transform:uppercase;letter-spacing:.5px;font-weight:700}
.nova-dash .kpi-val{font-size:21px;font-weight:800;letter-spacing:-.3px;color:var(--tx);direction:ltr;line-height:1.15;text-align:start}
.nova-dash .kpi-sub{font-size:11.5px;color:var(--mu);direction:ltr;text-align:start}
.nova-dash .kpi-sub.ok{color:var(--ok)} .nova-dash .kpi-sub.warn{color:var(--dg)}
.nova-dash .grid2{display:grid;grid-template-columns:1.5fr 1fr;gap:14px;align-items:stretch}
.nova-dash .card{background:var(--card);border:1px solid var(--bd);border-radius:14px;box-shadow:var(--shadow)}
.nova-dash .card-h{display:flex;align-items:center;gap:10px;padding:14px 18px;border-bottom:1px solid var(--bd)}
.nova-dash .card-h h3{font-size:13.5px;font-weight:700}
.nova-dash .card-h .sub{font-size:11.5px;color:var(--mu);font-weight:500}
.nova-dash .card-h .right{margin-inline-start:auto;display:flex;align-items:center;gap:8px}
.nova-dash .viewall{font-size:11.5px;font-weight:700;display:inline-flex;align-items:center;min-height:24px;padding:4px 6px;margin:-4px -6px;border-radius:8px;text-decoration:none}
.nova-dash .card-b{padding:12px 18px 16px}
.nova-dash .quick{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;padding:14px 18px}
.nova-dash .qa{display:flex;flex-direction:column;gap:9px;padding:14px 15px;border:1px solid var(--bd);border-radius:12px;background:var(--c2);text-decoration:none;transition:.14s}
.nova-dash .qa:hover{border-color:var(--ac);transform:translateY(-1px);box-shadow:var(--shadow)}
.nova-dash .qa .mi{font-size:20px;color:var(--ac)}
.nova-dash .qa span{font-size:12.5px;font-weight:600;color:var(--tx)}
.nova-dash .qa small{font-size:10.5px;color:var(--mu)}
.nova-dash .act{display:flex;gap:12px;padding:11px 4px;border-bottom:1px solid var(--bd)}
.nova-dash .act:last-child{border-bottom:none}
.nova-dash .act .ai{width:32px;height:32px;flex:0 0 32px;border-radius:9px;display:flex;align-items:center;justify-content:center;background:var(--c2);border:1px solid var(--bd);color:var(--ac);font-size:16px}
.nova-dash .act .ab{min-width:0;flex:1}
.nova-dash .act .ab .ttl{font-size:12.5px;font-weight:600;color:var(--tx);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nova-dash .act .ab .mt{font-size:11px;color:var(--mu);margin-top:2px;display:flex;gap:8px;flex-wrap:wrap}
.nova-dash .act .tm{font-size:10.5px;color:var(--mu);white-space:nowrap;direction:ltr}
.nova-dash .sys{display:flex;flex-direction:column;gap:0}
.nova-dash .srow{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 18px;border-bottom:1px solid var(--bd);font-size:12.5px}
.nova-dash .srow:last-child{border-bottom:none}
.nova-dash .srow .k{color:var(--mu);font-weight:500}
.nova-dash .srow .v{color:var(--tx);font-weight:600;font-variant-numeric:tabular-nums;min-width:0;overflow:hidden;text-overflow:ellipsis;direction:ltr}
.nova-dash .empty{color:var(--mu);font-size:12px;padding:14px 2px;text-align:center}
@media(max-width:920px){ .nova-dash .grid2{grid-template-columns:1fr} }
`;

function fmt(n) {
  if (n == null) return "0";
  if (n >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, "") + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, "") + "K";
  return String(n);
}

export default function DashboardHome({ machineId }) {
  const [stats, setStats] = useState(null);
  const [provCount, setProvCount] = useState(null);
  const [enabledCount, setEnabledCount] = useState(null);
  const [version, setVersion] = useState(null);
  const [settings, setSettings] = useState(null);
  const [requireLogin, setRequireLogin] = useState(true);
  const [healthOpen, setHealthOpen] = useState(false);

  useEffect(() => {
    let on = true;
    (async () => {
      const fetchJson = async (url) => {
        try {
          const r = await fetch(url);
          if (!r.ok) return null;
          return await r.json();
        } catch { return null; }
      };
      // The header's notification bell owns action items now, so this page no
      // longer fetches them.
      const [s, p, v, st, rl] = await Promise.all([
        fetchJson("/api/usage/stats?period=7d"),
        fetchJson("/api/providers"),
        fetchJson("/api/version"),
        fetchJson("/api/settings"),
        fetchJson("/api/settings/require-login"),
      ]);
      if (!on) return;
      setStats(s);
      setProvCount(p?.connections?.length ?? null);
      setEnabledCount(p?.connections?.filter((c) => c.isActive !== false).length ?? null);
      setVersion(v);
      setSettings(st);
      setRequireLogin(rl?.requireLogin ?? st?.requireLogin ?? true);
    })();
    return () => { on = false; };
  }, []);

  const totalTokens = stats
    ? (stats.totalPromptTokens || 0) + (stats.totalCompletionTokens || 0)
    : 0;
  const recent = stats?.recentRequests || [];
  const dbDriver = settings?.dbDriver || settings?.databaseDriver || settings?.storageDriver;

  const acts = [
    { href: "/dashboard/endpoint", icon: "api", label: "Endpoint & Key", sub: "API base URL & key" },
    { href: "/dashboard/providers", icon: "dns", label: "Providers", sub: "Connect upstreams" },
    { href: "/dashboard/combos", icon: "layers", label: "Combos", sub: "Fallback & vision" },
    { href: "/dashboard/usage", icon: "bar_chart", label: "Usage", sub: "Requests & tokens" },
    { href: "/dashboard/quota", icon: "data_usage", label: "Quota Tracker", sub: "Limits per key" },
    { href: "/dashboard/token-saver", icon: "savings", label: "Token Saver", sub: "Compress prompts" },
  ];

  return (
    <div className="nova-dash">
      <style>{CSS}</style>

      {/* Welcome/status strip. The "Dashboard" heading that used to sit here
          duplicated the app header's title, so the strip now carries only
          what the header does not: the greeting and the live status chip. */}
      <div className="hero">
        <div className="h-ic"><img src="/logo-mark-mono.svg" alt="" aria-hidden="true" /></div>
        <div className="h-t">
          <p className="h-lead">{translate("Welcome back")}</p>
          <p>{translate("overview_sub")}</p>
        </div>
        <span className="h-chip"><span className="d" />{translate("Operational")}</span>
        <button
          type="button"
          onClick={() => setHealthOpen(true)}
          className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold px-3 py-1.5 rounded-full border border-border text-text-muted hover:text-primary hover:border-primary/40 transition-colors"
        >
          <span className="material-symbols-outlined text-[15px]">health_and_safety</span>
          {translate("System Health")}
        </button>
      </div>

      {healthOpen && <SystemHealthModal onClose={() => setHealthOpen(false)} />}

      {/* Action items are not rendered here any more. They are standing
          warnings, and they now live in the notification bell in the header,
          which is on every page - having them here as well meant the dashboard
          carried a stack of banners the bell knew nothing about. */}

      {/* KPI grid */}
      <div className="kpi-grid">
        <div className="kpi">
          <div className="kpi-top">
            <div className="kpi-ic"><span className="material-symbols-outlined text-[19px]">dns</span></div>
            <span className="lbl">{translate("Providers")}</span>
          </div>
          <div className="kpi-val">{provCount ?? "—"}</div>
          <div className="kpi-sub ok">{enabledCount ?? "—"} {translate("Active")}</div>
        </div>
        <div className="kpi">
          <div className="kpi-top">
            <div className="kpi-ic"><span className="material-symbols-outlined text-[19px]">call_made</span></div>
            <span className="lbl">{translate("Requests")} · 7d</span>
          </div>
          <div className="kpi-val">{stats ? fmt(stats.totalRequests) : "—"}</div>
          <div className="kpi-sub">{translate("In the last 7 days")}</div>
        </div>
        <div className="kpi">
          <div className="kpi-top">
            <div className="kpi-ic"><span className="material-symbols-outlined text-[19px]">token</span></div>
            <span className="lbl">{translate("Tokens")} · 7d</span>
          </div>
          <div className="kpi-val">{stats ? fmt(totalTokens) : "—"}</div>
          <div className="kpi-sub">{translate("In the last 7 days")}</div>
        </div>
        <div className="kpi">
          <div className="kpi-top">
            <div className="kpi-ic"><span className="material-symbols-outlined text-[19px]">shield</span></div>
            <span className="lbl">{translate("Gateway")}</span>
          </div>
          <div className="kpi-val">{version?.currentVersion ? `v${version.currentVersion}` : "—"}</div>
          <div className={`kpi-sub ${version?.hasUpdate ? "warn" : "ok"}`}>
            {version?.hasUpdate ? `${translate("New version")} v${version.latestVersion}` : translate("Up to date")}
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="card">
        <div className="card-h">
          <h3>{translate("Quick Actions")}</h3>
        </div>
        <div className="quick">
          {acts.map((a) => (
            <Link key={a.href} href={a.href} className="qa">
              <span className="mi material-symbols-outlined">{a.icon}</span>
              <span>{translate(a.label)}</span>
              <small>{a.sub}</small>
            </Link>
          ))}
        </div>
      </div>

      {/* Two-column: recent + system */}
      <div className="grid2">
        <div className="card">
          <div className="card-h">
            <h3>{translate("Recent Requests")}</h3>
            <span className="right">
              <Link href="/dashboard/usage" className="viewall" style={{ color: "var(--ac)" }}>
                {translate("View all")} →
              </Link>
            </span>
          </div>
          <div className="card-b">
            {recent.length === 0 ? (
              <div className="empty">{translate("No activity yet")}</div>
            ) : (
              recent.slice(0, 7).map((r, i) => (
                <div className="act" key={i}>
                  <div className="ai"><span className="material-symbols-outlined text-[16px]">chat_bubble</span></div>
                  <div className="ab">
                    <div className="ttl">{r.model || "—"}</div>
                    <div className="mt">
                      <span>{r.provider || "unknown"}</span>
                      <span dir="ltr">{fmt((r.promptTokens || 0) + (r.completionTokens || 0))} tok</span>
                    </div>
                  </div>
                  <span className="tm">{r.timestamp ? r.timestamp.slice(11, 19) : ""}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-h">
            <h3>{translate("System Status")}</h3>
          </div>
          <div className="sys">
            <div className="srow"><span className="k">{translate("Status")}</span><span className="v" style={{ color: "var(--ok)" }}>● {translate("Operational")}</span></div>
            <div className="srow"><span className="k">{translate("Version")}</span><span className="v">{version?.currentVersion ? `v${version.currentVersion}` : "—"}</span></div>
            <div className="srow"><span className="k">Machine ID</span><span className="v" title={machineId}>{machineId ? machineId.slice(0, 18) + "…" : "—"}</span></div>
            <div className="srow"><span className="k">{translate("Login required")}</span><span className="v">{requireLogin ? translate("Yes") : translate("No")}</span></div>
            <div className="srow"><span className="k">DB</span><span className="v">{dbDriver || "—"}</span></div>
            <div className="srow"><span className="k">{translate("Update")}</span><span className="v" style={{ color: version?.hasUpdate ? "var(--dg)" : "var(--ok)" }}>{version?.hasUpdate ? `v${version.latestVersion} ✦` : translate("Up to date")}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
