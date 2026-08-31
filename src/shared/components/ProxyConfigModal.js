"use client";
import { useState, useEffect } from "react";
import Modal from "@/shared/components/Modal";
import Button from "@/shared/components/Button";
import Input from "@/shared/components/Input";
import Badge from "@/shared/components/Badge";

const PROXY_TYPES = [
  { value: "http", label: "HTTP" },
  { value: "https", label: "HTTPS" },
  { value: "socks5", label: "SOCKS5" },
];

export default function ProxyConfigModal({ isOpen, onClose, level = "global", levelId, levelLabel, onSaved }) {
  const [proxies, setProxies] = useState([]);
  const [selectedProxy, setSelectedProxy] = useState(null);
  const [newProxy, setNewProxy] = useState({ name: "", type: "http", host: "", port: "", username: "", password: "" });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetch("/api/settings/proxies")
        .then((r) => r.json())
        .then((d) => { setProxies(d.proxies || []); if (d.proxies?.length) setSelectedProxy(d.proxies[0]); })
        .catch(() => {});
    }
  }, [isOpen]);

  const handleSave = async () => {
    setLoading(true);
    try {
      await fetch("/api/settings/proxies", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level, levelId, proxyId: selectedProxy?.id || null }),
      });
      onSaved?.();
      onClose();
    } catch { /* fail-open */ } finally { setLoading(false); }
  };

  const handleAddProxy = async () => {
    try {
      const res = await fetch("/api/settings/proxies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newProxy),
      });
      const data = await res.json();
      setProxies([...proxies, data.proxy || { ...newProxy, id: Date.now().toString() }]);
      setNewProxy({ name: "", type: "http", host: "", port: "", username: "", password: "" });
    } catch { /* fail-open */ }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Proxy Config${levelLabel ? ` — ${levelLabel}` : ""}`}>
      <div className="space-y-4">
        <div>
          <p className="text-xs text-text-muted mb-2">Select proxy for {level}{levelId ? ` "${levelId}"` : ""}</p>
          {proxies.length === 0 ? (
            <p className="text-sm text-text-muted py-4 text-center">No proxies configured. Add one below.</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {proxies.map((p) => (
                <div key={p.id} onClick={() => setSelectedProxy(p)} className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-colors ${selectedProxy?.id === p.id ? "border-primary bg-primary/5" : "border-surface-3 hover:bg-surface-2"}`}>
                  <div>
                    <span className="text-sm font-medium text-text-main">{p.name || p.host}</span>
                    <p className="text-xs text-text-muted">{p.type} · {p.host}:{p.port}</p>
                  </div>
                  <Badge size="sm">{p.type}</Badge>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-surface-3 pt-4">
          <p className="text-xs font-semibold text-text-muted mb-2">Add New Proxy</p>
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Name" value={newProxy.name} onChange={(e) => setNewProxy({ ...newProxy, name: e.target.value })} />
            <select value={newProxy.type} onChange={(e) => setNewProxy({ ...newProxy, type: e.target.value })} className="py-2 px-3 bg-surface-2 border border-surface-3 rounded-xl text-sm text-text-main">
              {PROXY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <Input placeholder="Host" value={newProxy.host} onChange={(e) => setNewProxy({ ...newProxy, host: e.target.value })} />
            <Input placeholder="Port" value={newProxy.port} onChange={(e) => setNewProxy({ ...newProxy, port: e.target.value })} />
            <Input placeholder="Username (optional)" value={newProxy.username} onChange={(e) => setNewProxy({ ...newProxy, username: e.target.value })} />
            <Input type="password" placeholder="Password (optional)" value={newProxy.password} onChange={(e) => setNewProxy({ ...newProxy, password: e.target.value })} />
          </div>
          <Button size="sm" variant="ghost" onClick={handleAddProxy} disabled={!newProxy.host} className="mt-2">Add Proxy</Button>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={loading}>{loading ? "Saving..." : "Save"}</Button>
        </div>
      </div>
    </Modal>
  );
}
