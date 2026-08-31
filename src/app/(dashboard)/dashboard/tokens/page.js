"use client";
import { useState, useEffect, useCallback } from "react";
import Card, { CardSkeleton } from "@/shared/components/Card";
import Button from "@/shared/components/Button";
import Input from "@/shared/components/Input";
import Badge from "@/shared/components/Badge";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";
import { translate } from "@/i18n/runtime";
import { ConfirmModal } from "@/shared/components/Modal";

const EXPIRY_OPTIONS = [
  { value: 7, label: translate("7 days") },
  { value: 30, label: translate("30 days") },
  { value: 90, label: translate("90 days") },
  { value: 365, label: translate("365 days") },
];

export default function TokensPage() {
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", amount: 1000, expiresDays: 30 });
  const [redeemCode, setRedeemCode] = useState("");
  const [tab, setTab] = useState("list");
  const [notice, setNotice] = useState(null); // { tone: "success"|"error", text }
  const [confirmState, setConfirmState] = useState(null);
  const { copied: copiedId, copy } = useCopyToClipboard();

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/tokens");
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setTokens(data.tokens || []);
    } catch (err) {
      setNotice({ tone: "error", text: err.message || translate("Failed to load tokens") });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    try {
      const res = await fetch("/api/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          amount: Number(form.amount) || 0,
          expiresDays: Number(form.expiresDays) || 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || translate("Failed to create token"));
      setNotice({ tone: "success", text: `${translate("Token created")} — ${translate("Code")}: ${data.code}` });
      setForm({ name: "", amount: 1000, expiresDays: 30 });
      setTab("list");
      load();
    } catch (err) {
      setNotice({ tone: "error", text: err.message });
    }
  };

  const handleRedeem = async () => {
    if (!redeemCode.trim()) return;
    try {
      const res = await fetch("/api/tokens/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: redeemCode.trim() }),
      });
      const result = await res.json();
      if (!res.ok || result.error) throw new Error(result.error || translate("Redeem failed"));
      setNotice({ tone: "success", text: `${translate("Token redeemed")}: ${result.token?.name || redeemCode.trim()}` });
      setRedeemCode("");
      load();
    } catch (err) {
      setNotice({ tone: "error", text: err.message });
    }
  };

  const handleDelete = (id) => {
    setConfirmState({
      title: translate("Delete Token"),
      message: translate("This token will be permanently removed."),
      onConfirm: async () => {
        setConfirmState(null);
        try {
          await fetch(`/api/tokens?id=${id}`, { method: "DELETE" });
          load();
        } catch { /* fail-open */ }
      },
    });
  };

  const handleRevoke = async (id) => {
    try {
      await fetch(`/api/tokens?id=${id}&action=revoke`, { method: "DELETE" });
      load();
    } catch { /* fail-open */ }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-main">{translate("Redeem Tokens")}</h1>
        <p className="text-sm text-text-muted mt-1">{translate("Create redeem codes and hand them to your users; a code credits nothing until it is redeemed.")}</p>
      </div>

      {notice && (
        <div
          className={`px-3 py-2 rounded-xl border text-sm ${
            notice.tone === "success"
              ? "border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400"
              : "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400"
          }`}
        >
          {notice.text}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {[
          { key: "list", label: translate("Tokens") },
          { key: "create", label: translate("Create") },
          { key: "redeem", label: translate("Redeem") },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? "border-primary text-primary"
                : "border-transparent text-text-muted hover:text-text-main"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Token List */}
      {tab === "list" && (
        <Card className="overflow-hidden p-0">
          {loading ? (
            <div className="p-6"><CardSkeleton /></div>
          ) : tokens.length === 0 ? (
            <div className="py-12 text-center text-sm text-text-muted">{translate("No tokens yet. Create one to get a redeem code.")}</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-surface-2 text-text-muted text-xs uppercase">
                <tr>
                  <th className="p-3 text-start">{translate("Name")}</th>
                  <th className="p-3 text-start">{translate("Code")}</th>
                  <th className="p-3 text-center">{translate("Amount")}</th>
                  <th className="p-3 text-center">{translate("Status")}</th>
                  <th className="p-3 text-end">{translate("Expires")}</th>
                  <th className="p-3 text-end">{translate("Actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {tokens.map((t) => (
                  <tr key={t.id} className="hover:bg-surface-2/50">
                    <td className="p-3 font-medium text-text-main">{t.name}</td>
                    <td className="p-3">
                      <button
                        onClick={() => copy(t.code, t.id)}
                        className="inline-flex items-center gap-1.5 font-mono text-xs text-primary hover:underline"
                        title={translate("Copy code")}
                      >
                        {t.code}
                        <span className="material-symbols-outlined text-[13px]">{copiedId === t.id ? "check" : "content_copy"}</span>
                      </button>
                    </td>
                    <td className="p-3 text-center font-semibold text-text-main tabular-nums">{(t.amount || 0).toLocaleString()}</td>
                    <td className="p-3 text-center">
                      <Badge variant={t.status === "active" ? "success" : t.status === "redeemed" ? "primary" : "danger"} size="sm">
                        {translate(t.status === "active" ? "Active" : t.status === "redeemed" ? "Redeemed" : t.status === "expired" ? "Expired" : "Revoked")}
                      </Badge>
                    </td>
                    <td className="p-3 text-end text-text-muted text-xs">
                      {t.expiresAt ? new Date(t.expiresAt).toLocaleDateString() : "—"}
                    </td>
                    <td className="p-3 text-end">
                      <div className="flex items-center justify-end gap-1">
                        {t.status === "active" && (
                          <Button size="sm" variant="ghost" onClick={() => handleRevoke(t.id)}>
                            {translate("Revoke")}
                          </Button>
                        )}
                        <button
                          onClick={() => handleDelete(t.id)}
                          className="p-1.5 rounded-lg text-text-muted hover:text-danger hover:bg-surface-2 transition-colors"
                          aria-label={translate("Delete Token")}
                        >
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {/* Create Token */}
      {tab === "create" && (
        <Card className="p-5 space-y-4">
          <h3 className="text-sm font-semibold text-text-main">{translate("Create New Token")}</h3>
          <form onSubmit={handleCreate} className="space-y-4 max-w-md">
            <Input
              label={translate("Token Name")}
              placeholder="project-x-budget"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            <Input
              label={translate("Amount")}
              type="number"
              min={1}
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: parseInt(e.target.value) || 0 })}
            />
            <div>
              <label className="text-sm font-medium text-text-main mb-1.5 block">{translate("Expiry")}</label>
              <select
                value={form.expiresDays}
                onChange={(e) => setForm({ ...form, expiresDays: Number(e.target.value) })}
                className="w-full py-2.5 px-3 bg-surface-2 border border-border rounded-xl text-sm text-text-main"
              >
                {EXPIRY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <Button type="submit">{translate("Create Token")}</Button>
          </form>
        </Card>
      )}

      {/* Redeem Code */}
      {tab === "redeem" && (
        <Card className="p-5 space-y-4">
          <h3 className="text-sm font-semibold text-text-main">{translate("Redeem a Token Code")}</h3>
          <p className="text-sm text-text-muted">{translate("Enter a redeem code and mark it as used.")}</p>
          <div className="flex gap-2 max-w-md">
            <Input
              placeholder="NV-XXXX-XXXX-XXXX"
              value={redeemCode}
              onChange={(e) => setRedeemCode(e.target.value)}
              className="flex-1 font-mono"
            />
            <Button onClick={handleRedeem} disabled={!redeemCode.trim()}>{translate("Redeem")}</Button>
          </div>
        </Card>
      )}

      <ConfirmModal
        isOpen={!!confirmState}
        onClose={() => setConfirmState(null)}
        onConfirm={confirmState?.onConfirm}
        title={confirmState?.title || translate("Confirm")}
        message={confirmState?.message}
        variant="danger"
      />
    </div>
  );
}
