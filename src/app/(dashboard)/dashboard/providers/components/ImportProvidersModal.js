"use client";
import { useState, useRef } from "react";
import { Card, Button, Badge } from "@/shared/components";
import Modal from "@/shared/components/Modal";

export default function ImportProvidersModal({ isOpen, onClose, onComplete }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const fileRef = useRef(null);

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setResult(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        const items = Array.isArray(data) ? data : data.providers || data.connections || [data];
        setPreview(items.slice(0, 10));
      } catch {
        setPreview(null);
        setResult({ error: "Invalid JSON file" });
      }
    };
    reader.readAsText(f);
  };

  const handleImport = async () => {
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const res = await fetch("/api/providers/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: JSON.parse(text) }),
      });
      const data = await res.json();
      setResult(data);
      if (data.success) onComplete?.();
    } catch (err) {
      setResult({ error: err.message });
    } finally {
      setImporting(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) {
      setFile(f);
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target.result);
          const items = Array.isArray(data) ? data : data.providers || data.connections || [data];
          setPreview(items.slice(0, 10));
        } catch { setPreview(null); }
      };
      reader.readAsText(f);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Import Providers" size="lg">
      <div className="space-y-4">
        {!file ? (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className="border-2 border-dashed border-surface-3 rounded-xl p-12 text-center hover:border-primary/50 transition-colors cursor-pointer"
            onClick={() => fileRef.current?.click()}
          >
            <span className="material-symbols-outlined text-[48px] text-text-muted mb-3">upload_file</span>
            <p className="text-sm text-text-main font-medium">Drop a JSON file here or click to browse</p>
            <p className="text-xs text-text-muted mt-1">Supports NovaRoute, Nova Route, and generic provider export formats</p>
            <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleFile} />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="primary" size="sm">{file.name}</Badge>
                <span className="text-sm text-text-muted">{preview?.length || 0} providers found</span>
              </div>
              <Button size="sm" variant="ghost" onClick={() => { setFile(null); setPreview(null); setResult(null); }}>
                <span className="material-symbols-outlined text-[16px]">close</span>
              </Button>
            </div>

            {preview && preview.length > 0 && (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {preview.map((p, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-surface-3/50 text-sm">
                    <Badge variant="primary" size="sm">{p.provider || p.id || "?"}</Badge>
                    <span className="text-text-main truncate flex-1">{p.name || p.connectionName || "—"}</span>
                    <span className="text-text-muted text-xs">{p.models?.length || 0} models</span>
                  </div>
                ))}
              </div>
            )}

            {result && (
              <div className={`p-4 rounded-xl ${result.error ? "bg-danger/10" : "bg-success/10"}`}>
                <p className={`text-sm font-medium ${result.error ? "text-danger" : "text-success"}`}>
                  {result.error || `Imported ${result.imported || 0} providers successfully`}
                </p>
              </div>
            )}

            <Button onClick={handleImport} disabled={importing} className="w-full">
              {importing ? "Importing..." : "Import All"}
            </Button>
          </>
        )}
      </div>
    </Modal>
  );
}
