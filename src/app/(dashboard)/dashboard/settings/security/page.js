"use client";
import { useState, useEffect } from "react";
import Card from "@/shared/components/Card";
import Toggle from "@/shared/components/Toggle";
import Input from "@/shared/components/Input";
import Button from "@/shared/components/Button";
import { useNotificationStore } from "@/store/notificationStore";
import { useSettings } from "../SettingsShell";

function Section({ title, description, children }) {
  return (
    <Card className="p-5 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-text-main">{title}</h3>
        {description && <p className="text-xs text-text-muted mt-0.5">{description}</p>}
      </div>
      {children}
    </Card>
  );
}

function FieldRow({ label, description, children }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div className="min-w-0">
        <p className="text-sm font-medium text-text-main">{label}</p>
        {description && <p className="text-xs text-text-muted">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export default function SecuritySettingsPage() {
  const { settings, save } = useSettings();
  const [newPassword, setNewPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState("");
  const [revoking, setRevoking] = useState(false);
  const [showAddKeyLimit, setShowAddKeyLimit] = useState(false);
  const [newKeyLimitName, setNewKeyLimitName] = useState("");

  if (!settings) return null;

  const security = settings.security || {};

  const updateSecurity = (patch) => {
    save({ security: { ...security, ...patch } });
  };

  const handleChangePassword = async () => {
    if (!newPassword || !currentPassword) return;
    setPasswordSaving(true);
    setPasswordMsg("");
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword, currentPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPasswordMsg(data.error || "Could not change the password.");
        return;
      }
      setNewPassword("");
      setCurrentPassword("");
      setPasswordMsg("Password changed. Other devices have been signed out.");
    } catch {
      setPasswordMsg("Could not change the password.");
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Section title="Authentication" description="Login and session management">
        <FieldRow
          label="Require Login"
          description="Enable password authentication for the dashboard"
        >
          <Toggle
            checked={settings.requireLogin ?? false}
            onChange={(val) => save({ requireLogin: val })}
          />
        </FieldRow>
        <div className="flex items-center gap-2 mt-2">
          <Input
            type="password"
            placeholder="Current password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="flex-1"
          />
          <Input
            type="password"
            placeholder="New password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="flex-1"
          />
          <Button
            size="sm"
            onClick={handleChangePassword}
            disabled={!newPassword || !currentPassword || passwordSaving}
          >
            {passwordSaving ? "Saving..." : "Change Password"}
          </Button>
        </div>
        {passwordMsg && (
          <p className="text-xs text-text-muted mt-2">{passwordMsg}</p>
        )}
        <FieldRow
          label="Revoke All Sessions"
          description="Sign out of NovaRoute on every device. You will need to log in again."
        >
          <Button
            size="sm"
            variant="secondary"
            disabled={revoking}
            onClick={async () => {
              if (!window.confirm("Revoke all sessions? Every signed-in device (including this one) will be logged out.")) return;
              setRevoking(true);
              try {
                await fetch("/api/auth/revoke-sessions", { method: "POST" });
                window.location.assign("/login");
              } catch {
                setRevoking(false);
              }
            }}
          >
            {revoking ? "Revoking..." : "Log Out Everywhere"}
          </Button>
        </FieldRow>
      </Section>

      <UsersSection />
      <TwoFactorSection />
      <SessionsSection />
      <AuditTrailSection />

      <Section title="API Key Policy" description="Control which API keys can access which models">
        <FieldRow
          label="Enforce API Key Policy"
          description="Enable per-key model access restrictions"
        >
          <Toggle
            checked={security.enforceApiKeyPolicy ?? false}
            onChange={(val) => updateSecurity({ enforceApiKeyPolicy: val })}
          />
        </FieldRow>
        <FieldRow
          label="Require API Key"
          description="Require an API key for all /v1 requests (not just chat)"
        >
          <Toggle
            checked={security.requireApiKey ?? true}
            onChange={(val) => updateSecurity({ requireApiKey: val })}
          />
        </FieldRow>
      </Section>

      <Section title="IP Filtering" description="Restrict access by IP address">
        <FieldRow
          label="Enable IP Allowlist"
          description="Only allow requests from listed IPs"
        >
          <Toggle
            checked={security.ipAllowlist?.enabled ?? false}
            onChange={(val) =>
              updateSecurity({ ipAllowlist: { ...(security.ipAllowlist || {}), enabled: val } })
            }
          />
        </FieldRow>
        {security.ipAllowlist?.enabled && (
          <Input
            placeholder="127.0.0.1, 192.168.1.0/24"
            value={security.ipAllowlist?.ips || ""}
            onChange={(e) =>
              updateSecurity({ ipAllowlist: { ...security.ipAllowlist, ips: e.target.value } })
            }
          />
        )}
      </Section>

      <Section title="Blocked Providers" description="Prevent routing to specific providers">
        <div className="flex flex-wrap gap-2">
          {(security.blockedProviders || []).map((p) => (
            <span
              key={p}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-surface-3 rounded-full text-xs text-text-main"
            >
              {p}
              <button
                onClick={() =>
                  updateSecurity({
                    blockedProviders: (security.blockedProviders || []).filter((x) => x !== p),
                  })
                }
                className="text-text-muted hover:text-danger"
              >
                <span className="material-symbols-outlined text-[14px]">close</span>
              </button>
            </span>
          ))}
        </div>
        <Input
          placeholder="Add provider ID to block"
          onKeyDown={(e) => {
            if (e.key === "Enter" && e.target.value.trim()) {
              updateSecurity({
                blockedProviders: [...(security.blockedProviders || []), e.target.value.trim()],
              });
              e.target.value = "";
            }
          }}
        />
      </Section>

      <Section title="Banned Keywords" description="Block requests containing specific keywords in the prompt">
        <div className="flex flex-wrap gap-2">
          {(security.bannedKeywords || []).map((kw) => (
            <span
              key={kw}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-surface-3 rounded-full text-xs text-text-main"
            >
              {kw}
              <button
                onClick={() =>
                  updateSecurity({
                    bannedKeywords: (security.bannedKeywords || []).filter((x) => x !== kw),
                  })
                }
                className="text-text-muted hover:text-danger"
              >
                <span className="material-symbols-outlined text-[14px]">close</span>
              </button>
            </span>
          ))}
        </div>
        <Input
          placeholder="Add banned keyword"
          onKeyDown={(e) => {
            if (e.key === "Enter" && e.target.value.trim()) {
              updateSecurity({
                bannedKeywords: [...(security.bannedKeywords || []), e.target.value.trim()],
              });
              e.target.value = "";
            }
          }}
        />
      </Section>

      <Section title="Credential Redaction" description="How sensitive fields appear in logs and UI">
        <FieldRow label="Redact API Keys in Logs">
          <Toggle
            checked={security.redactCredentials ?? true}
            onChange={(val) => updateSecurity({ redactCredentials: val })}
          />
        </FieldRow>
      </Section>

      <Section title="Per-Key Rate Limits" description="Set rate limits for individual API keys">
        <div className="space-y-2">
          {(security.keyLimits || []).map((kl, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-surface-3/30">
              <span className="font-mono text-xs text-text-main w-32 truncate">{kl.keyName || "unnamed"}</span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={kl.rpm || 0}
                  onChange={(e) => {
                    const updated = [...(security.keyLimits || [])];
                    updated[i] = { ...updated[i], rpm: Number(e.target.value) };
                    updateSecurity({ keyLimits: updated });
                  }}
                  className="w-16 rounded-lg border border-border bg-surface px-2 py-1 text-xs text-text-main text-right outline-none focus:border-primary/40"
                  title="Requests per minute"
                />
                <span className="text-[10px] text-text-muted">rpm</span>
              </div>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={kl.tpd || 0}
                  onChange={(e) => {
                    const updated = [...(security.keyLimits || [])];
                    updated[i] = { ...updated[i], tpd: Number(e.target.value) };
                    updateSecurity({ keyLimits: updated });
                  }}
                  className="w-20 rounded-lg border border-border bg-surface px-2 py-1 text-xs text-text-main text-right outline-none focus:border-primary/40"
                  title="Tokens per day"
                />
                <span className="text-[10px] text-text-muted">tpd</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-text-muted">$</span>
                <input
                  type="number"
                  step="0.01"
                  value={kl.cpd || 0}
                  onChange={(e) => {
                    const updated = [...(security.keyLimits || [])];
                    updated[i] = { ...updated[i], cpd: Number(e.target.value) };
                    updateSecurity({ keyLimits: updated });
                  }}
                  className="w-16 rounded-lg border border-border bg-surface px-2 py-1 text-xs text-text-main text-right outline-none focus:border-primary/40"
                  title="Cost per day"
                />
                <span className="text-[10px] text-text-muted">/day</span>
              </div>
              <button onClick={() => {
                const updated = [...(security.keyLimits || [])];
                updated.splice(i, 1);
                updateSecurity({ keyLimits: updated });
              }} className="text-text-muted hover:text-danger ms-auto">
                <span className="material-symbols-outlined text-[14px]">delete</span>
              </button>
            </div>
          ))}
        </div>
        {showAddKeyLimit ? (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-surface-3/30">
            <input
              type="text"
              value={newKeyLimitName}
              onChange={(e) => setNewKeyLimitName(e.target.value)}
              placeholder="Key name"
              className="flex-1 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-text-main outline-none focus:border-primary/40"
              autoFocus
            />
            <Button size="sm" onClick={() => {
              if (newKeyLimitName) {
                updateSecurity({ keyLimits: [...(security.keyLimits || []), { keyName: newKeyLimitName, rpm: 60, tpd: 100000, cpd: 5.0 }] });
                setNewKeyLimitName("");
                setShowAddKeyLimit(false);
              }
            }}>Add</Button>
            <Button size="sm" variant="ghost" onClick={() => { setShowAddKeyLimit(false); setNewKeyLimitName(""); }}>Cancel</Button>
          </div>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => setShowAddKeyLimit(true)}>+ Add Key Limit</Button>
        )}
      </Section>
    </div>
  );
}

// ─── Two-Factor Authentication (TOTP) ──────────────────────────────────────
function TwoFactorSection() {
  const notify = useNotificationStore();
  const [enabled, setEnabled] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [setup, setSetup] = useState(null);
  const [code, setCode] = useState("");
  const [disablePassword, setDisablePassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/auth/2fa")
      .then((r) => r.json())
      .then((d) => setEnabled(d?.enabled === true))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const post = async (body) => {
    setBusy(true);
    try {
      const res = await fetch("/api/auth/2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Request failed");
      return d;
    } catch (err) {
      notify.error(err.message);
      return null;
    } finally {
      setBusy(false);
    }
  };

  if (!loaded) return null;

  return (
    <Section
      title="Two-Factor Authentication"
      description="Require a 6-digit authenticator code (TOTP) after the password on every login."
    >
      <FieldRow label="Status" description={enabled ? "2FA is active — authenticator code required at login." : "2FA is off."}>
        <span className={`text-xs font-semibold px-2 py-1 rounded-lg ${enabled ? "bg-success/10 text-success" : "bg-surface-3 text-text-muted"}`}>
          {enabled ? "ON" : "OFF"}
        </span>
      </FieldRow>

      {!enabled && !setup && (
        <Button
          size="sm"
          variant="primary"
          disabled={busy}
          onClick={async () => {
            const d = await post({ action: "setup" });
            if (d) setSetup(d);
          }}
        >
          Set up 2FA
        </Button>
      )}

      {setup && !enabled && (
        <div className="space-y-3 p-3 rounded-xl bg-surface-3/40 border border-border-subtle">
          <p className="text-xs text-text-muted">
            1. Add this secret to your authenticator app (Google Authenticator, Aegis, 1Password…) as a TIME-based token.
          </p>
          <div className="flex items-center gap-2">
            <code dir="ltr" className="flex-1 truncate px-2 py-1.5 rounded-lg bg-surface border border-border-subtle text-xs font-mono">{setup.secret}</code>
            <Button size="sm" variant="secondary" onClick={() => navigator.clipboard.writeText(setup.secret).catch(() => {})}>Copy</Button>
          </div>
          <details>
            <summary className="text-xs text-primary cursor-pointer">Show otpauth:// URI</summary>
            <code dir="ltr" className="block mt-2 p-2 rounded-lg bg-surface border border-border-subtle text-[11px] font-mono break-all">{setup.otpauthUri}</code>
          </details>
          <p className="text-xs text-text-muted">2. Enter the current 6-digit code to confirm and activate.</p>
          <div className="flex gap-2">
            <Input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="000000" maxLength={6} className="max-w-[140px]" dir="ltr" />
            <Button
              size="sm"
              variant="primary"
              disabled={busy || code.length !== 6}
              onClick={async () => {
                const d = await post({ action: "enable", code });
                if (d) {
                  setEnabled(true);
                  setSetup(null);
                  setCode("");
                  notify.success("Two-factor authentication enabled");
                }
              }}
            >
              Activate
            </Button>
          </div>
        </div>
      )}

      {enabled && (
        <div className="space-y-2">
          <Input
            type="password"
            placeholder="Dashboard password OR current 6-digit code to disable"
            value={disablePassword}
            onChange={(e) => setDisablePassword(e.target.value)}
          />
          <Button
            size="sm"
            variant="secondary"
            disabled={busy || !disablePassword}
            onClick={async () => {
              const isCode = /^\d{6}$/.test(disablePassword.trim());
              const d = await post(
                isCode
                  ? { action: "disable", code: disablePassword.trim() }
                  : { action: "disable", password: disablePassword }
              );
              if (d) {
                setEnabled(false);
                setDisablePassword("");
                notify.success("Two-factor authentication disabled");
              }
            }}
          >
            Disable 2FA
          </Button>
        </div>
      )}
    </Section>
  );
}

// ─── Active sessions ───────────────────────────────────────────────────────
function SessionsSection() {
  const notify = useNotificationStore();
  const [sessions, setSessions] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const load = () =>
    fetch("/api/auth/sessions")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setSessions(Array.isArray(d?.sessions) ? d.sessions : []))
      .catch(() => {})
      .finally(() => setLoaded(true));

  useEffect(() => {
    load();
  }, []);

  if (!loaded) return null;

  return (
    <Section title="Active Sessions" description="Recent logins. Revoke a device to sign it out within a minute.">
      {sessions.length === 0 ? (
        <p className="text-sm text-text-muted">No recorded sessions yet — they appear after new logins.</p>
      ) : (
        <div className="space-y-2">
          {sessions.map((s) => (
            <div key={s.sid} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-surface-3/50 border border-border-subtle">
              <div className="min-w-0">
                <p className="text-sm text-text-main truncate" dir="ltr">{s.userAgent || "Unknown device"}</p>
                <p className="text-xs text-text-muted" dir="ltr">
                  {s.ip || "—"} · {s.createdAt ? new Date(s.createdAt).toLocaleString() : "—"}
                </p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={async () => {
                  const res = await fetch(`/api/auth/sessions?sid=${encodeURIComponent(s.sid)}`, { method: "DELETE" });
                  if (res.ok) {
                    notify.success("Session revoked");
                    load();
                  } else {
                    const d = await res.json().catch(() => ({}));
                    notify.error(d.error || "Failed to revoke");
                  }
                }}
              >
                Revoke
              </Button>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

/* ──────────────────────────────────────────────────────────────
   Audit trail — every administrative write, newest first
   ────────────────────────────────────────────────────────────── */
function AuditTrailSection() {
  const notify = useNotificationStore();
  const [entries, setEntries] = useState([]);
  const [sensitiveOnly, setSensitiveOnly] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = (onlySensitive) =>
    fetch(`/api/security/audit?limit=50${onlySensitive ? "&sensitive=1" : ""}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setEntries(Array.isArray(d?.entries) ? d.entries : []))
      .catch(() => {})
      .finally(() => setLoaded(true));

  useEffect(() => {
    load(false);
  }, []);

  if (!loaded) return null;

  return (
    <Section
      title="Audit Trail"
      description="Administrative changes recorded on this instance. Reads are not logged."
    >
      <div className="flex items-center justify-between gap-3">
        <FieldRow label="Sensitive changes only" description="Auth, keys, database, updates, OAuth, tunnels">
          <Toggle
            checked={sensitiveOnly}
            onChange={(val) => {
              setSensitiveOnly(val);
              load(val);
            }}
          />
        </FieldRow>
      </div>

      {entries.length === 0 ? (
        <p className="text-sm text-text-muted">Nothing recorded yet.</p>
      ) : (
        <div className="space-y-1.5 max-h-80 overflow-y-auto">
          {entries.map((e, i) => (
            <div
              key={`${e.at}-${i}`}
              className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-surface-3/50 border border-border-subtle"
            >
              <div className="min-w-0">
                <p className="text-xs text-text-main truncate" dir="ltr">
                  <span className={e.sensitive ? "text-warning font-semibold" : "font-semibold"}>{e.method}</span>{" "}
                  {e.path}
                </p>
                <p className="text-[11px] text-text-muted" dir="ltr">
                  {e.actor} · {e.ip || "—"} · {e.at ? new Date(e.at).toLocaleString() : "—"}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      <Button
        size="sm"
        variant="secondary"
        onClick={async () => {
          if (!window.confirm("Clear the audit trail? This cannot be undone.")) return;
          const res = await fetch("/api/security/audit", { method: "DELETE" });
          if (res.ok) {
            notify.success("Audit trail cleared");
            load(sensitiveOnly);
          } else {
            notify.error("Failed to clear the trail");
          }
        }}
      >
        Clear trail
      </Button>
    </Section>
  );
}

/* ──────────────────────────────────────────────────────────────
   Users — accounts and roles
   ────────────────────────────────────────────────────────────── */
const ROLE_LABELS = {
  admin: "Admin",
  operator: "Operator",
  viewer: "Viewer",
};

function UsersSection() {
  const notify = useNotificationStore();
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [allowed, setAllowed] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ username: "", password: "", role: "operator" });

  const load = () =>
    fetch("/api/users")
      .then(async (r) => {
        if (r.status === 403) {
          setAllowed(false);
          return null;
        }
        return r.ok ? r.json() : null;
      })
      .then((d) => {
        if (!d) return;
        setUsers(Array.isArray(d.users) ? d.users : []);
        setRoles(Array.isArray(d.roles) ? d.roles : []);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));

  useEffect(() => {
    load();
  }, []);

  if (!loaded || !allowed) return null;

  const patch = async (id, body, okMessage) => {
    const res = await fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      notify.success(okMessage);
      load();
    } else {
      notify.error(data.error || "Could not update the account");
    }
  };

  return (
    <Section
      title="Users"
      description="Accounts that can sign into this dashboard. Roles decide what each one may change."
    >
      {users.length === 0 ? (
        <p className="text-sm text-text-muted">
          One shared password is in use. Add an account to give people their own login and role.
        </p>
      ) : (
        <div className="space-y-2">
          {users.map((u) => (
            <div
              key={u.id}
              className="flex items-center justify-between gap-3 p-3 rounded-xl bg-surface-3/50 border border-border-subtle"
            >
              <div className="min-w-0">
                <p className="text-sm text-text-main truncate">
                  {u.username}
                  {!u.isActive && <span className="text-xs text-text-muted"> · disabled</span>}
                </p>
                <p className="text-xs text-text-muted" dir="ltr">
                  {ROLE_LABELS[u.role] || u.role}
                  {u.lastLoginAt ? ` · last login ${new Date(u.lastLoginAt).toLocaleString()}` : " · never signed in"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  className="text-xs bg-surface-2 border border-border rounded-lg px-2 py-1.5 text-text-main"
                  value={u.role}
                  onChange={(e) => patch(u.id, { role: e.target.value }, "Role updated")}
                >
                  {(roles.length ? roles.map((r) => r.role) : ["admin", "operator", "viewer"]).map((role) => (
                    <option key={role} value={role}>
                      {ROLE_LABELS[role] || role}
                    </option>
                  ))}
                </select>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => patch(u.id, { isActive: !u.isActive }, u.isActive ? "Account disabled" : "Account enabled")}
                >
                  {u.isActive ? "Disable" : "Enable"}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={async () => {
                    if (!window.confirm(`Delete ${u.username}?`)) return;
                    const res = await fetch(`/api/users/${u.id}`, { method: "DELETE" });
                    const data = await res.json().catch(() => ({}));
                    if (res.ok) {
                      notify.success("Account deleted");
                      load();
                    } else {
                      notify.error(data.error || "Could not delete the account");
                    }
                  }}
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAdd ? (
        <div className="space-y-3 p-3 rounded-xl border border-border bg-surface-2/50">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Username"
              value={form.username}
              onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
              placeholder="e.g. sara"
            />
            <Input
              label="Password"
              type="password"
              value={form.password}
              onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
              placeholder="at least 6 characters"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">Role</label>
            <select
              className="w-full text-sm bg-surface-2 border border-border rounded-lg px-3 py-2 text-text-main"
              value={form.role}
              onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
            >
              {(roles.length ? roles : [{ role: "operator", description: "" }]).map((r) => (
                <option key={r.role} value={r.role}>
                  {ROLE_LABELS[r.role] || r.role}
                  {r.description ? ` — ${r.description}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={async () => {
                const res = await fetch("/api/users", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(form),
                });
                const data = await res.json().catch(() => ({}));
                if (res.ok) {
                  notify.success(`${form.username} added`);
                  setForm({ username: "", password: "", role: "operator" });
                  setShowAdd(false);
                  load();
                } else {
                  notify.error(data.error || "Could not create the account");
                }
              }}
            >
              Create account
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setShowAdd(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button size="sm" onClick={() => setShowAdd(true)}>
          Add user
        </Button>
      )}
    </Section>
  );
}
