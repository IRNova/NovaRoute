"use client";
import { useState, useEffect } from "react";
import Card from "@/shared/components/Card";
import Badge from "@/shared/components/Badge";
import Button from "@/shared/components/Button";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";
import { translate } from "@/i18n/runtime";
import { DEFAULT_PLUGINS, LOCAL_STDIO_PLUGINS } from "@/shared/constants/coworkPlugins";

export default function MCPSection() {
  const [origin, setOrigin] = useState("");
  const [appPort, setAppPort] = useState(20128);
  const [coworkInstalled, setCoworkInstalled] = useState(null); // null = checking
  const { copied: copiedId, copy } = useCopyToClipboard();

  useEffect(() => {
    if (typeof window !== "undefined") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOrigin(window.location.origin);
    }
    fetch("/api/server-info", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.port) setAppPort(d.port); })
      .catch(() => {});
    // Best-effort: reflect whether the Cowork integration already applied these plugins.
    fetch("/api/cli-tools/cowork-settings", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { setCoworkInstalled(!!d?.installed); })
      .catch(() => setCoworkInstalled(null));
  }, []);

  const totalTools =
    DEFAULT_PLUGINS.reduce((s, p) => s + (p.toolNames?.length || 0), 0) +
    LOCAL_STDIO_PLUGINS.reduce((s, p) => s + (p.toolNames?.length || 0), 0);

  return (
    <div className="flex flex-col gap-6">
      {/* Hero section */}
      <div className="relative overflow-hidden rounded-brand-lg border border-border bg-surface p-5">
        <div className="relative z-10 flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-brand bg-primary/15 text-primary">
            <span className="material-symbols-outlined text-[22px]" aria-hidden="true">dns</span>
          </div>
          <div className="max-w-2xl">
            <h3 className="text-base font-semibold text-text-main mb-1">{translate("MCP Servers")}</h3>
            <p className="text-sm leading-relaxed text-text-muted">
              {translate("Built-in Model Context Protocol plugins exposed by your gateway")}
            </p>
          </div>
        </div>
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
      </div>

      {/* Stats bar */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-xs">
        <span className="inline-flex items-center gap-1.5 text-text-muted">
          <span className="material-symbols-outlined text-[14px]">public</span>
          <span className="tabular-nums font-semibold text-text-main">{DEFAULT_PLUGINS.length}</span>
          {translate("remote plugins")}
        </span>
        <span className="text-text-muted">·</span>
        <span className="inline-flex items-center gap-1.5 text-text-muted">
          <span className="material-symbols-outlined text-[14px]">terminal</span>
          <span className="tabular-nums font-semibold text-text-main">{LOCAL_STDIO_PLUGINS.length}</span>
          {translate("local servers")}
        </span>
        <span className="text-text-muted">·</span>
        <span className="inline-flex items-center gap-1.5 text-text-muted">
          <span className="material-symbols-outlined text-[14px]">build</span>
          <span className="tabular-nums font-semibold text-text-main">{totalTools}</span>
          {translate("tools")}
        </span>
      </div>

      {/* Remote plugins */}
      <Card className="p-5 space-y-3">
        <h4 className="text-sm font-semibold text-text-main">{translate("Remote plugins (HTTPS)")}</h4>
        {DEFAULT_PLUGINS.map((p) => (
          <div key={p.name} className="flex items-start gap-3 p-3 rounded-xl bg-surface-2/40 hover:bg-surface-2/60 transition-colors">
            <span className="w-2.5 h-2.5 rounded-full shrink-0 mt-1.5 bg-green-500" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-text-main text-sm">{p.title || p.name}</span>
                <Badge size="sm">{p.transport}</Badge>
                {p.oauth && <Badge size="sm">OAuth</Badge>}
                <span className="text-xs text-text-muted">{p.toolNames?.length || 0} {translate("tools")}</span>
              </div>
              <p className="text-xs text-text-muted mt-0.5">{p.description}</p>
              <code className="text-xs font-mono text-text-muted block truncate mt-1">{p.url}</code>
            </div>
            <Button size="sm" variant="ghost" onClick={() => copy(p.url, `mcp_${p.name}`)}>
              <span className="material-symbols-outlined text-[14px]">{copiedId === `mcp_${p.name}` ? "check" : "content_copy"}</span>
            </Button>
          </div>
        ))}
      </Card>

      {/* Local stdio servers via SSE bridge */}
      <Card className="p-5 space-y-3">
        <h4 className="text-sm font-semibold text-text-main">{translate("Local servers (stdio → SSE bridge)")}</h4>
        {LOCAL_STDIO_PLUGINS.map((p) => {
          const bridgeUrl = origin ? `${origin}/api/mcp/${p.name}/sse` : `/api/mcp/${p.name}/sse`;
          return (
            <div key={p.name} className="flex items-start gap-3 p-3 rounded-xl bg-surface-2/40 hover:bg-surface-2/60 transition-colors">
              <span className="w-2.5 h-2.5 rounded-full shrink-0 mt-1.5 bg-primary" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-text-main text-sm">{p.title || p.name}</span>
                  <Badge size="sm">sse</Badge>
                  <span className="text-xs text-text-muted">{p.toolNames?.length || 0} {translate("tools")}</span>
                </div>
                <p className="text-xs text-text-muted mt-0.5">{p.description}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <code className="text-xs font-mono text-primary truncate flex-1 min-w-0">{bridgeUrl}</code>
                  <Button size="sm" variant="ghost" onClick={() => copy(bridgeUrl, `mcp_${p.name}`)}>
                    <span className="material-symbols-outlined text-[14px]">{copiedId === `mcp_${p.name}` ? "check" : "content_copy"}</span>
                  </Button>
                </div>
                {p.extensionUrl && (
                  <a href={p.extensionUrl} target="_blank" rel="noreferrer" className="text-xs text-primary underline mt-1 inline-block">
                    {translate("Install Chrome extension")}
                  </a>
                )}
              </div>
            </div>
          );
        })}
        <p className="text-xs text-text-muted leading-relaxed">
          {translate("Point any MCP-compatible client (e.g. Cursor, Claude Desktop, Cline) at the bridge URL above. The gateway spawns the server on demand and proxies JSON-RPC over SSE.")}
        </p>
      </Card>

      {/* Cowork integration status */}
      <Card className="p-4">
        <div className="flex items-start gap-3">
          <span className="material-symbols-outlined text-primary text-[18px] mt-0.5">info</span>
          <div className="text-xs text-text-muted leading-relaxed">
            <p className="font-medium text-text-main mb-1">{translate("How these plugins are activated")}</p>
            <p>
              {translate("These MCP servers are injected into AI clients through the Cowork integration (Dashboard → CLI Tools → Cowork). Apply your settings there and the tools above become available inside chat requests.")}
              {" "}
              {coworkInstalled === true && translate("Claude Desktop detected ✓")}
              {coworkInstalled === false && translate("Claude Desktop (Cowork mode) not detected on this machine — the bridge URL still works with any external MCP client.")}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
