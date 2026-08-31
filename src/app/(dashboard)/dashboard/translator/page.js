"use client";
import { translate } from "@/i18n/runtime";
import { useState, useEffect, useRef } from "react";
import Card, { CardSkeleton } from "@/shared/components/Card";
import Button from "@/shared/components/Button";
import Select from "@/shared/components/Select";
import Input from "@/shared/components/Input";
import Badge from "@/shared/components/Badge";
import Toggle from "@/shared/components/Toggle";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";
import dynamic from "next/dynamic";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const Editor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

const STEPS = [
  { id: 1, label: "Client Request", file: "1_req_client.json", lang: "json", desc: "Raw request from client" },
  { id: 2, label: "Source Body", file: "2_req_source.json", lang: "json", desc: "After initial conversion" },
  { id: 3, label: "OpenAI Intermediate", file: "3_req_openai.json", lang: "json", desc: "source -> openai" },
  { id: 4, label: "Target Request", file: "4_req_target.json", lang: "json", desc: "openai -> target + URL + headers" },
  { id: 5, label: "Provider Response", file: "5_res_provider.txt", lang: "text", desc: "Raw SSE from provider" },
  { id: 6, label: "OpenAI Response", file: "6_res_openai.txt", lang: "text", desc: "target -> openai (response)" },
  { id: 7, label: "Client Response", file: "7_res_client.txt", lang: "text", desc: "Final response to client" },
];

const EDITOR_OPTIONS = {
  minimap: { enabled: false },
  fontSize: 12,
  lineNumbers: "on",
  scrollBeyondLastLine: false,
  wordWrap: "on",
  automaticLayout: true,
  readOnly: true,
};

const SAMPLE_REQUESTS = {
  openai: `{ "model": "gpt-4o", "messages": [{ "role": "user", "content": "Hello" }], "stream": true }`,
  claude: `{ "model": "claude-sonnet-4-20250514", "max_tokens": 1024, "messages": [{ "role": "user", "content": "Hello" }] }`,
  gemini: `{ "contents": [{ "role": "user", "parts": [{ "text": "Hello" }] }] }`,
};

export default function TranslatorPage() {
  const [contents, setContents] = useState({});
  const [expanded, setExpanded] = useState({ 1: true });
  const [loading, setLoading] = useState({});
  const [proxyRoutes, setProxyRoutes] = useState([]);
  const [newProxy, setNewProxy] = useState({ url: "", label: "" });
  const [meta, setMeta] = useState(null);
  const [tab, setTab] = useState("pipeline");
  const { copied: _copied, copy } = useCopyToClipboard();

  // Monitor state
  const [monitorActive, setMonitorActive] = useState(false);
  const [monitorRequests, setMonitorRequests] = useState([]);
  const [monitorFilter, setMonitorFilter] = useState("");
  const monitorRef = useRef(null);

  // Test bench state
  const [testInput, setTestInput] = useState(SAMPLE_REQUESTS.openai);
  const [testSource, setTestSource] = useState("openai");
  const [testTarget, setTestTarget] = useState("claude");
  const [testResult, setTestResult] = useState(null);
  const [testLoading, setTestLoading] = useState(false);

  // Compression preview
  const [compressionStats, setCompressionStats] = useState(null);

  const setLoad = (key, val) => setLoading((prev) => ({ ...prev, [key]: val }));

  const handleAddProxy = () => {
    if (!newProxy.url) return;
    setProxyRoutes([...proxyRoutes, { url: newProxy.url, label: newProxy.label, active: true, latency: 0 }]);
    setNewProxy({ url: "", label: "" });
  };

  const handleRemoveProxy = (index) => {
    setProxyRoutes(proxyRoutes.filter((_, i) => i !== index));
  };

  const loadStep = async (step) => {
    setLoad(step.id, true);
    try {
      const res = await fetch(`/api/request-details?file=${step.file}`);
      if (res.ok) {
        const data = await res.json();
        const text = typeof data === "string" ? data : JSON.stringify(data, null, 2);
        setContents((prev) => ({ ...prev, [step.id]: text }));
        if (step.id === 1 && data) {
          try {
            const parsed = typeof data === "string" ? JSON.parse(data) : data;
            setMeta({
              provider: parsed.provider || parsed.model?.split("/")[0] || "unknown",
              model: parsed.model || "unknown",
              sourceFormat: parsed._sourceFormat || "openai",
            });
          } catch {
            // ignore
          }
        }
      } else {
        setContents((prev) => ({ ...prev, [step.id]: "// No data available for this step" }));
      }
    } catch {
      setContents((prev) => ({ ...prev, [step.id]: "// Failed to load step data" }));
    } finally {
      setLoad(step.id, false);
    }
  };

  // Monitor SSE
  useEffect(() => {
    if (!monitorActive) {
      if (monitorRef.current) monitorRef.current.close();
      return;
    }
    const es = new EventSource("/api/request-details?stream=true");
    monitorRef.current = es;
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        setMonitorRequests((prev) => [data, ...prev].slice(0, 100));
      } catch {
        // ignore
      }
    };
    es.onerror = () => {
      setMonitorActive(false);
    };
    return () => {
      es.close();
    };
  }, [monitorActive]);

  const handleTranslate = async () => {
    setTestLoading(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Test-Translate": "1",
        },
        body: JSON.stringify({
          ...JSON.parse(testInput),
          model: `${testTarget}/${JSON.parse(testInput).model || "default"}`,
        }),
      });
      const text = await res.text();
      setTestResult(text);
    } catch (err) {
      setTestResult(`// Error: ${err.message}`);
    } finally {
      setTestLoading(false);
    }
  };

  const filteredMonitor = monitorFilter
    ? monitorRequests.filter(
        (r) =>
          (r.provider || "").toLowerCase().includes(monitorFilter.toLowerCase()) ||
          (r.model || "").toLowerCase().includes(monitorFilter.toLowerCase()) ||
          (r.status || "").toString().includes(monitorFilter)
      )
    : monitorRequests;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-main">{translate("Request Translator")}</h1>
          <p className="text-sm text-text-muted mt-1">Inspect and test format translation across providers</p>
        </div>
        {meta && (
          <div className="flex gap-2">
            <Badge variant="primary">{meta.sourceFormat} → {meta.provider}</Badge>
            <Badge variant="success">{meta.model}</Badge>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-surface-3">
        {[
          { key: "pipeline", label: translate("Pipeline") },
          { key: "test", label: translate("Test Bench") },
          { key: "monitor", label: translate("Monitor") },
          { key: "compression", label: translate("Compression") },
          { key: "transformer", label: translate("Stream Transformer") },
          { key: "hooks", label: translate("Advanced Hooks") },
          { key: "custom-pipelines", label: translate("Custom Pipelines") },
          { key: "proxy-integration", label: translate("Proxy Integration") },
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

      {/* Pipeline Tab */}
      {tab === "pipeline" && (
        <div className="space-y-3">
          <Card className="p-4">
            <p className="text-xs text-text-muted mb-3">Request flows through each step sequentially. Click any step to inspect its data.</p>
            <div className="flex items-center gap-1 overflow-x-auto pb-2">
              {STEPS.map((step, i) => (
                <div key={step.id} className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => { setExpanded({ [step.id]: true }); if (!contents[step.id]) loadStep(step); }}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      expanded[step.id] ? "bg-primary/15 text-primary" : contents[step.id] ? "bg-success/10 text-success" : "bg-surface-3/50 text-text-muted hover:bg-surface-3"
                    }`}
                  >
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      contents[step.id] ? "bg-success/20 text-success" : "bg-surface-3 text-text-muted"
                    }`}>{step.id}</span>
                    <span className="hidden sm:inline">{step.label}</span>
                  </button>
                  {i < STEPS.length - 1 && (
                    <span className="material-symbols-outlined text-[14px] text-text-muted/40">arrow_forward</span>
                  )}
                </div>
              ))}
            </div>
          </Card>

          {STEPS.map((step) => (
            <Card key={step.id} className="overflow-hidden">
              <button
                onClick={() => {
                  setExpanded((prev) => ({ ...prev, [step.id]: !prev[step.id] }));
                  if (!contents[step.id]) loadStep(step);
                }}
                className="w-full flex items-center justify-between p-4 hover:bg-surface-2/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                      contents[step.id] ? "bg-success/10 text-success" : "bg-surface-3 text-text-muted"
                    }`}
                  >
                    {step.id}
                  </span>
                  <div className="text-left">
                    <span className="text-sm font-medium text-text-main">{step.label}</span>
                    <span className="text-xs text-text-muted ms-2">{step.desc}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {loading[step.id] && (
                    <span className="text-xs text-primary animate-pulse">Loading...</span>
                  )}
                  <span className="material-symbols-outlined text-[18px] text-text-muted">
                    {expanded[step.id] ? "expand_less" : "expand_more"}
                  </span>
                </div>
              </button>
              {expanded[step.id] && (
                <div className="border-t border-surface-3">
                  <div className="flex items-center justify-between px-4 py-2 bg-surface-2/50">
                    <span className="text-xs text-text-muted">{step.file}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copy(contents[step.id] || "")}
                    >
                      <span className="material-symbols-outlined text-[14px]">content_copy</span>
                    </Button>
                  </div>
                  <Editor
                    height={300}
                    language={step.lang}
                    value={contents[step.id] || "// Click to load..."}
                    options={EDITOR_OPTIONS}
                    theme="vs-dark"
                  />
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Test Bench Tab */}
      {tab === "test" && (
        <div className="space-y-6">
          <Card className="p-5 space-y-4">
            <h3 className="text-sm font-semibold text-text-main">{translate("Translation Test")}</h3>
            <div className="flex gap-3">
              <Select
                label="Source Format"
                options={[
                  { value: "openai", label: "OpenAI" },
                  { value: "claude", label: "Claude" },
                  { value: "gemini", label: "Gemini" },
                ]}
                value={testSource}
                onChange={(e) => {
                  setTestSource(e.target.value);
                  setTestInput(SAMPLE_REQUESTS[e.target.value] || "");
                }}
              />
              <Select
                label="Target Provider"
                options={[
                  { value: "claude", label: "Claude (Anthropic)" },
                  { value: "openai", label: "OpenAI" },
                  { value: "gemini", label: "Gemini (Google)" },
                  { value: "deepseek", label: "DeepSeek" },
                  { value: "ollama-local", label: "Ollama (Local)" },
                ]}
                value={testTarget}
                onChange={(e) => setTestTarget(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-text-main mb-1.5 block">Request Body</label>
              <Editor
                height={200}
                language="json"
                value={testInput}
                onChange={(val) => setTestInput(val || "")}
                options={{ ...EDITOR_OPTIONS, readOnly: false }}
                theme="vs-dark"
              />
            </div>
            <Button onClick={handleTranslate} disabled={testLoading}>
              {testLoading ? "Translating..." : "Translate & Preview"}
            </Button>
          </Card>

          {testResult && (
            <Card className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-text-main">{translate("Translation Result")}</h3>
                <Button size="sm" variant="ghost" onClick={() => copy(testResult)}>
                  <span className="material-symbols-outlined text-[14px]">content_copy</span>
                </Button>
              </div>
              <Editor
                height={300}
                language="json"
                value={testResult}
                options={EDITOR_OPTIONS}
                theme="vs-dark"
              />
            </Card>
          )}
        </div>
      )}

      {/* Monitor Tab */}
      {tab === "monitor" && (
        <div className="space-y-4">
          <Card className="p-4 flex items-center gap-4">
            <Toggle checked={monitorActive} onChange={setMonitorActive} />
            <span className="text-sm font-medium text-text-main">
              {monitorActive ? "Monitoring active..." : "Start monitoring live requests"}
            </span>
            {monitorActive && (
              <Input
                placeholder="Filter by provider, model, or status..."
                value={monitorFilter}
                onChange={(e) => setMonitorFilter(e.target.value)}
                className="flex-1 ml-auto"
              />
            )}
          </Card>

          {filteredMonitor.length === 0 ? (
            <Card className="p-12 text-center">
              <span className="material-symbols-outlined text-[48px] text-text-muted mb-3">monitoring</span>
              <p className="text-sm text-text-muted">
                {monitorActive
                  ? "Waiting for requests... Send a request to /v1 to see it here."
                  : "Enable monitoring to see live translation requests."}
              </p>
            </Card>
          ) : (
            <div className="space-y-2">
              {filteredMonitor.map((req, i) => (
                <Card key={i} className="p-4">
                  <div className="flex items-center gap-3 text-sm">
                    <Badge variant={req.status >= 200 && req.status < 300 ? "success" : "danger"} size="sm">
                      {req.status || "?"}
                    </Badge>
                    <Badge variant="primary" size="sm">{req.provider || "?"}</Badge>
                    <span className="text-text-main font-mono text-xs">{req.model || "?"}</span>
                    <span className="text-text-muted ms-auto text-xs">{req.latencyMs ? `${req.latencyMs}ms` : ""}</span>
                    <span className="text-text-muted text-xs">{req.timestamp ? new Date(req.timestamp).toLocaleTimeString() : ""}</span>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Compression Tab */}
      {tab === "compression" && (
        <div className="space-y-6">
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-text-main mb-4">{translate("Token Compression Stats")}</h3>
            <p className="text-sm text-text-muted mb-4">
              View how the RTK (Token Saver) compresses tool results and system prompts.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 rounded-xl bg-surface-3/50">
                <p className="text-xs text-text-muted">Tool Results Compressed</p>
                <p className="text-xl font-bold text-text-main mt-1">{compressionStats?.toolResults || "—"}</p>
              </div>
              <div className="p-3 rounded-xl bg-surface-3/50">
                <p className="text-xs text-text-muted">System Prompt Compressed</p>
                <p className="text-xl font-bold text-text-main mt-1">{compressionStats?.systemPrompt || "—"}</p>
              </div>
              <div className="p-3 rounded-xl bg-surface-3/50">
                <p className="text-xs text-text-muted">Total Tokens Saved</p>
                <p className="text-xl font-bold text-success mt-1">{compressionStats?.tokensSaved || "—"}</p>
              </div>
              <div className="p-3 rounded-xl bg-surface-3/50">
                <p className="text-xs text-text-muted">Savings Rate</p>
                <p className="text-xl font-bold text-primary mt-1">{compressionStats?.savingsRate || "—"}</p>
              </div>
            </div>
          </Card>
          <Card className="p-12 text-center">
            <span className="material-symbols-outlined text-[48px] text-text-muted mb-3">compress</span>
            <p className="text-sm text-text-muted">Compression data will appear after requests are processed through the RTK pipeline.</p>
          </Card>
        </div>
      )}

      {tab === "transformer" && (
        <div className="space-y-6">
          <Card className="p-5 space-y-4">
            <h3 className="text-sm font-semibold text-text-main">{translate("Stream Transformer")}</h3>
            <p className="text-sm text-text-muted">Configure how SSE streams are transformed between formats.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-surface-3/50 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px] text-primary">input</span>
                  <span className="text-sm font-medium text-text-main">Input Format</span>
                </div>
                <p className="text-xs text-text-muted">OpenAI SSE (data: {`{...}`})</p>
              </div>
              <div className="p-4 rounded-xl bg-surface-3/50 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px] text-success">output</span>
                  <span className="text-sm font-medium text-text-main">Output Format</span>
                </div>
                <p className="text-xs text-text-muted">OpenAI SSE (data: {`{...}`})</p>
              </div>
            </div>
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-text-muted uppercase">Transform Rules</h4>
              {["Role Mapping", "Content Block Conversion", "Tool Use Normalization", "Stop Sequence Alignment"].map((rule) => (
                <div key={rule} className="flex items-center justify-between py-2 border-b border-surface-3 last:border-0">
                  <span className="text-sm text-text-main">{rule}</span>
                  <Badge variant="success" size="sm">Active</Badge>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {tab === "hooks" && (
        <div className="space-y-6">
          <Card className="p-5 space-y-4">
            <h3 className="text-sm font-semibold text-text-main">{translate("Advanced Hooks")}</h3>
            <p className="text-sm text-text-muted">Custom pre/post translation hooks for request/response transformation.</p>
            <div className="space-y-3">
              {[
                { name: "preTranslate", desc: "Modify request before translation", active: true },
                { name: "postTranslate", desc: "Modify response after translation", active: true },
                { name: "preStream", desc: "Modify stream before sending to client", active: false },
                { name: "postStream", desc: "Process stream chunks after provider response", active: false },
              ].map((hook) => (
                <div key={hook.name} className="flex items-center justify-between p-3 rounded-xl bg-surface-3/30">
                  <div>
                    <code className="text-sm font-mono text-primary">{hook.name}</code>
                    <p className="text-xs text-text-muted mt-0.5">{hook.desc}</p>
                  </div>
                  <Badge variant={hook.active ? "success" : "default"} size="sm">{hook.active ? "Enabled" : "Disabled"}</Badge>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {tab === "custom-pipelines" && (
        <div className="space-y-6">
          <Card className="p-5 space-y-4">
            <h3 className="text-sm font-semibold text-text-main">{translate("Custom Translation Pipelines")}</h3>
            <p className="text-xs text-text-muted">Define custom translation chains for specific provider pairs.</p>
            <div className="space-y-3">
              {[
                { name: "Claude → OpenAI Direct", from: "claude", to: "openai", priority: 1, status: "active" },
                { name: "Gemini → OpenAI Fallback", from: "gemini", to: "openai", priority: 2, status: "active" },
                { name: "DeepSeek → OpenAI", from: "deepseek", to: "openai", priority: 3, status: "disabled" },
              ].map((pipe, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-surface-3/30">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">{pipe.priority}</span>
                    <div>
                      <span className="text-sm font-medium text-text-main">{pipe.name}</span>
                      <p className="text-xs text-text-muted">{pipe.from} → {pipe.to}</p>
                    </div>
                  </div>
                  <Badge variant={pipe.status === "active" ? "success" : "default"} size="sm">{pipe.status}</Badge>
                </div>
              ))}
            </div>
            <Button size="sm">+ Add Pipeline</Button>
          </Card>
        </div>
      )}

      {tab === "proxy-integration" && (
        <div className="space-y-6">
          <Card className="p-5 space-y-4">
            <h3 className="text-sm font-semibold text-text-main">{translate("Proxy Integration")}</h3>
            <p className="text-xs text-text-muted">Route translation traffic through proxy pools.</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-surface-3/50 space-y-2">
                <span className="text-sm font-medium text-text-main">{translate("Active Proxies")}</span>
                <p className="text-2xl font-bold text-text-main">{proxyRoutes.filter((r) => r.active).length}</p>
              </div>
              <div className="p-4 rounded-xl bg-surface-3/50 space-y-2">
                <span className="text-sm font-medium text-text-main">{translate("Avg Proxy Latency")}</span>
                <p className="text-2xl font-bold text-text-main">{proxyRoutes.length > 0 ? `${Math.round(proxyRoutes.reduce((a, p) => a + p.latency, 0) / proxyRoutes.length)}ms` : "N/A"}</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-surface-3/30 space-y-3">
              <p className="text-xs font-semibold text-text-muted">{translate("Add Proxy Route")}</p>
              <div className="grid grid-cols-3 gap-3">
                <input
                  type="text"
                  value={newProxy.url}
                  onChange={(e) => setNewProxy({ ...newProxy, url: e.target.value })}
                  placeholder="socks5://host:port"
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-main font-mono outline-none focus:border-primary/40"
                />
                <input
                  type="text"
                  value={newProxy.label}
                  onChange={(e) => setNewProxy({ ...newProxy, label: e.target.value })}
                  placeholder={translate("Label")}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-main outline-none focus:border-primary/40"
                />
                <button
                  onClick={handleAddProxy}
                  disabled={!newProxy.url}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-white hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  <span className="material-symbols-outlined text-[14px]">add</span>
                  Add
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-text-muted">{translate("Proxy Routes")}</p>
              {proxyRoutes.length === 0 ? (
                <p className="text-xs text-text-muted italic py-2">No proxy routes configured</p>
              ) : (
                proxyRoutes.map((proxy, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-surface-3 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono text-text-main">{proxy.url}</span>
                      {proxy.label && <span className="text-xs text-text-muted">({proxy.label})</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={proxy.active ? "success" : "default"} size="sm">{proxy.active ? "active" : "inactive"}</Badge>
                      <button onClick={() => handleRemoveProxy(i)} className="text-text-muted hover:text-danger transition-colors">
                        <span className="material-symbols-outlined text-[14px]">delete</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
