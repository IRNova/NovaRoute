"use client";
import { useState, useEffect } from "react";
import NotImplementedNotice from "@/shared/components/NotImplementedNotice";
import Card from "@/shared/components/Card";
import Button from "@/shared/components/Button";
import Input from "@/shared/components/Input";
import Toggle from "@/shared/components/Toggle";
import Badge from "@/shared/components/Badge";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";

export default function VSCodeSection() {
  const [wired, setWired] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [token, setToken] = useState("");
  const [copy] = useCopyToClipboard();

  useEffect(() => {
    fetch("/api/vscode-token")
      .then((r) => r.json())
      .then((d) => {
        setWired(d.implemented !== false);
        setEnabled(d.enabled || false);
        setToken(d.token || "");
      })
      .catch(() => {});
  }, []);

  const handleToggle = async (val) => {
    setEnabled(val);
    try {
      await fetch("/api/vscode-token", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: val }),
      });
    } catch { /* fail-open */ }
  };

  const handleGenerate = async () => {
    try {
      const res = await fetch("/api/vscode-token", { method: "POST" });
      const data = await res.json();
      setToken(data.token || "");
    } catch { /* fail-open */ }
  };

  return (
    <Card className="p-5 space-y-4">
      {!wired && <NotImplementedNotice feature="VS Code token" />}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px] text-primary">code</span>
          <h3 className="text-sm font-semibold text-text-main">VS Code Integration</h3>
        </div>
        <Badge variant={enabled ? "success" : "default"} size="sm">{enabled ? "Active" : "Inactive"}</Badge>
      </div>
      <p className="text-xs text-text-muted">Use NovaRoute as the backend for VS Code Copilot and other AI extensions.</p>

      <div className="space-y-3">
        <Toggle checked={enabled} onChange={handleToggle} label="Enable VS Code Token" />
        {enabled && (
          <>
            <div className="flex gap-2">
              <Input
                label="Token"
                value={token}
                readOnly
                className="flex-1 font-mono"
              />
              <Button size="sm" variant="outline" onClick={() => copy(token)}>Copy</Button>
              <Button size="sm" onClick={handleGenerate}>Generate</Button>
            </div>
            <div className="p-3 bg-surface-3/50 rounded-xl text-xs text-text-muted space-y-1">
              <p className="font-medium text-text-main">Setup in VS Code:</p>
              <ol className="list-decimal list-inside space-y-0.5">
                <li>Install &quot;Continue&quot; or &quot;Copilot&quot; extension</li>
                <li>Open extension settings</li>
                <li>Set API Base URL to <code className="text-primary">http://localhost:20128/v1</code></li>
                <li>Paste the token above as the API key</li>
              </ol>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
