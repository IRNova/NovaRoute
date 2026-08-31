"use client";
import { useState, useEffect, useRef } from "react";
import Card, { CardSkeleton } from "@/shared/components/Card";
import Badge from "@/shared/components/Badge";
import Button from "@/shared/components/Button";
import Select from "@/shared/components/Select";
import Input from "@/shared/components/Input";

const SAMPLE_MODELS = [
  { value: "openai/gpt-4o", label: "GPT-4o (OpenAI)" },
  { value: "openai/gpt-4o-mini", label: "GPT-4o Mini (OpenAI)" },
  { value: "anthropic/claude-sonnet-4-20250514", label: "Claude Sonnet 4 (Anthropic)" },
  { value: "anthropic/claude-3-5-haiku-20241022", label: "Claude 3.5 Haiku (Anthropic)" },
  { value: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro (Google)" },
  { value: "deepseek/deepseek-chat", label: "DeepSeek Chat" },
];

function formatDuration(ms) {
  if (!ms || ms < 1) return "—";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function estimateTokens(text) {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

function readAssistantText(chunk) {
  if (!chunk || typeof chunk !== "object") return "";
  const choice = chunk.choices?.[0];
  const delta = choice?.delta || {};
  const pieces = [delta.content, choice?.message?.content, chunk.output_text, chunk.text]
    .filter((v) => typeof v === "string" && v);
  return pieces[0] || "";
}

export default function PlaygroundPage() {
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedModel, setSelectedModel] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("You are a helpful assistant.");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [lastLatency, setLastLatency] = useState(null);
  const [totalTokens, setTotalTokens] = useState({ prompt: 0, completion: 0 });
  const messagesEndRef = useRef(null);
  const abortRef = useRef(null);

  useEffect(() => {
    fetch("/api/playground")
      .then((r) => r.json())
      .then((d) => {
        setModels(d.models || SAMPLE_MODELS);
        setSelectedModel(d.models?.[0]?.value || SAMPLE_MODELS[0].value);
        setLoading(false);
      })
      .catch(() => { setModels(SAMPLE_MODELS); setSelectedModel(SAMPLE_MODELS[0].value); setLoading(false); });
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;

    const userMsg = { role: "user", content: text };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");
    setSending(true);
    setLastLatency(null);
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    const promptTokens = estimateTokens(systemPrompt) + nextMessages.reduce((sum, m) => sum + estimateTokens(m.content), 0);
    setTotalTokens((prev) => ({ ...prev, prompt: prev.prompt + promptTokens }));

    const apiMessages = [
      ...(systemPrompt.trim() ? [{ role: "system", content: systemPrompt.trim() }] : []),
      ...nextMessages.map((m) => ({ role: m.role, content: m.content })),
    ];

    const startTime = performance.now();
    let assistantText = "";

    try {
      const response = await fetch("/api/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify({ model: selectedModel, messages: apiMessages, stream: true }),
        signal: abortRef.current.signal,
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error?.message || err.message || `Request failed (${response.status})`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        const data = await response.json().catch(() => ({}));
        assistantText = data.choices?.[0]?.message?.content || JSON.stringify(data);
      } else {
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split(/\r?\n/);
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const payload = trimmed.slice(5).trim();
            if (!payload || payload === "[DONE]") continue;
            try {
              const chunk = JSON.parse(payload);
              const text = readAssistantText(chunk);
              if (text) {
                assistantText += text;
                setMessages((prev) => {
                  const last = prev[prev.length - 1];
                  if (last?.role === "assistant" && last.streaming) {
                    return [...prev.slice(0, -1), { ...last, content: assistantText }];
                  }
                  return [...prev, { role: "assistant", content: assistantText, streaming: true }];
                });
              }
            } catch {}
          }
        }
      }

      const latency = performance.now() - startTime;
      setLastLatency(Math.round(latency));
      const completionTokens = estimateTokens(assistantText);
      setTotalTokens((prev) => ({ ...prev, completion: prev.completion + completionTokens }));

      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return [...prev.slice(0, -1), { ...last, content: assistantText || last.content, streaming: false }];
        }
        return [...prev, { role: "assistant", content: assistantText }];
      });
    } catch (error) {
      if (error.name !== "AbortError") {
        const latency = performance.now() - startTime;
        setLastLatency(Math.round(latency));
        setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${error.message}`, error: true }]);
      }
    } finally {
      setSending(false);
      abortRef.current = null;
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClear = () => {
    setMessages([]);
    setTotalTokens({ prompt: 0, completion: 0 });
    setLastLatency(null);
  };

  const handleStop = () => {
    abortRef.current?.abort();
  };

  if (loading) return <div className="p-6 max-w-5xl mx-auto space-y-4"><CardSkeleton /><CardSkeleton /><CardSkeleton /></div>;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-main">Playground</h1>
          <p className="text-sm text-text-muted mt-1">Interactive chat for testing models and prompts</p>
        </div>
        <div className="flex items-center gap-3">
          {lastLatency != null && <Badge variant="default">{formatDuration(lastLatency)}</Badge>}
          {(totalTokens.prompt > 0 || totalTokens.completion > 0) && (
            <Badge variant="default">{(totalTokens.prompt + totalTokens.completion).toLocaleString()} tokens</Badge>
          )}
          <Button size="sm" variant="ghost" icon="delete_sweep" onClick={handleClear} disabled={messages.length === 0}>Clear</Button>
        </div>
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Model"
            options={models}
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
          />
          <Input
            label="System Prompt"
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            placeholder="You are a helpful assistant."
          />
        </div>
      </Card>

      <Card className="p-0 overflow-hidden flex flex-col" style={{ minHeight: "400px" }}>
        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar" style={{ maxHeight: "50vh" }}>
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-center">
              <span className="material-symbols-outlined text-[48px] text-text-muted mb-3">chat</span>
              <p className="text-sm text-text-muted">Send a message to start the conversation.</p>
            </div>
          ) : (
            messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-6 whitespace-pre-wrap break-words ${
                  msg.role === "user"
                    ? "bg-primary text-on-primary rounded-tr-sm"
                    : msg.error
                      ? "bg-red-500/10 border border-red-500/20 text-red-500 rounded-tl-sm"
                      : "bg-surface border border-border text-text-main rounded-tl-sm"
                }`}>
                  {msg.streaming && !msg.content ? (
                    <span className="inline-block w-2 h-4 align-middle bg-text-muted/50 animate-pulse ml-0.5" />
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="border-t border-border-subtle p-3">
          <div className="flex items-end gap-3">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              rows={1}
              disabled={sending}
              className="flex-1 resize-none bg-surface-3/50 border border-border-subtle rounded-xl px-4 py-2.5 text-sm text-text-main outline-none placeholder:text-text-muted focus:border-primary/40 focus:ring-1 focus:ring-primary/10 transition-all max-h-[120px] overflow-y-auto custom-scrollbar disabled:opacity-60"
            />
            <div className="flex items-center gap-2 shrink-0">
              {sending && (
                <Button size="sm" variant="ghost" icon="stop" onClick={handleStop}>Stop</Button>
              )}
              <Button
                size="sm"
                icon="send"
                onClick={handleSend}
                disabled={!input.trim() || sending}
              >
                Send
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {(totalTokens.prompt > 0 || totalTokens.completion > 0) && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="p-3">
            <p className="text-[11px] text-text-muted uppercase tracking-wide">Messages</p>
            <p className="text-lg font-bold text-text-main mt-1">{messages.filter((m) => !m.error).length}</p>
          </Card>
          <Card className="p-3">
            <p className="text-[11px] text-text-muted uppercase tracking-wide">Prompt Tokens</p>
            <p className="text-lg font-bold text-primary mt-1">{totalTokens.prompt.toLocaleString()}</p>
          </Card>
          <Card className="p-3">
            <p className="text-[11px] text-text-muted uppercase tracking-wide">Completion Tokens</p>
            <p className="text-lg font-bold text-success mt-1">{totalTokens.completion.toLocaleString()}</p>
          </Card>
          <Card className="p-3">
            <p className="text-[11px] text-text-muted uppercase tracking-wide">Last Latency</p>
            <p className="text-lg font-bold text-text-main mt-1">{lastLatency != null ? formatDuration(lastLatency) : "—"}</p>
          </Card>
        </div>
      )}
    </div>
  );
}
