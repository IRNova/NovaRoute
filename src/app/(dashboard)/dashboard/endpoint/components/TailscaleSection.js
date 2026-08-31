"use client";
import { useState, useEffect } from "react";
import NotImplementedNotice from "@/shared/components/NotImplementedNotice";
import Card from "@/shared/components/Card";
import Button from "@/shared/components/Button";
import Input from "@/shared/components/Input";
import Toggle from "@/shared/components/Toggle";
import Badge from "@/shared/components/Badge";
import { translate } from "@/i18n/runtime";

export default function TailscaleSection() {
  const [wired, setWired] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [hostname, setHostname] = useState("");
  const [tailscaleUrl, setTailscaleUrl] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/tailscale")
      .then((r) => r.json())
      .then((d) => {
        setWired(d.implemented !== false);
        setEnabled(d.enabled || false);
        setHostname(d.hostname || "");
        setTailscaleUrl(d.tailscaleUrl || "");
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleToggle = async (val) => {
    setEnabled(val);
    try {
      await fetch("/api/tailscale", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: val }),
      });
    } catch { /* fail-open */ }
  };

  return (
    <Card className="p-5 space-y-4">
      {!wired && <NotImplementedNotice feature="Tailscale" />}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px] text-primary">vpn_lock</span>
          <h3 className="text-sm font-semibold text-text-main">Tailscale</h3>
        </div>
        <Badge variant={enabled ? "success" : "default"} size="sm">{enabled ? translate("Connected") : translate("Disconnected")}</Badge>
      </div>
      <p className="text-xs text-text-muted">{translate("Access your NovaRoute instance securely over Tailscale VPN network.")}</p>

      <div className="space-y-3">
        <Toggle checked={enabled} onChange={handleToggle} label={translate("Enable Tailscale")} />
        {enabled && (
          <>
            <Input
              label="Hostname"
              placeholder="novaroute"
              value={hostname}
              onChange={(e) => setHostname(e.target.value)}
            />
            {tailscaleUrl && (
              <div className="p-3 bg-surface-3/50 rounded-xl">
                <p className="text-xs text-text-muted">Tailscale URL</p>
                <p className="text-sm text-primary font-mono">{tailscaleUrl}</p>
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  );
}
