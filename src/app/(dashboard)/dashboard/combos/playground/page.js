"use client";
import { useState, useEffect } from "react";
import Card from "@/shared/components/Card";
import Button from "@/shared/components/Button";
import Input from "@/shared/components/Input";
import Badge from "@/shared/components/Badge";

export default function ComboPlaygroundPage() {
  const [combos, setCombos] = useState([]);
  const [selected, setSelected] = useState("");
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/combos")
      .then((r) => r.json())
      .then((d) => {
        setCombos(d.combos || []);
        if (d.combos?.length) setSelected(d.combos[0].name);
      })
      .catch(() => {});
  }, []);

  const handleTest = async () => {
    if (!prompt) return;
    setLoading(true);
    setResponse("");
    try {
      const res = await fetch("/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selected,
          messages: [{ role: "user", content: prompt }],
          stream: false,
        }),
      });
      const data = await res.json();
      setResponse(data.choices?.[0]?.message?.content || JSON.stringify(data, null, 2));
    } catch (e) {
      setResponse("Error: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  if (!combos.length)
    return (
      <div className="p-6 text-center text-text-muted">
        Create a combo first to use the playground.
      </div>
    );

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-text-main">Combo Playground</h1>
        <Badge variant="primary">LIVE TEST</Badge>
      </div>

      <Card title="Configuration">
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <label className="text-xs uppercase text-text-muted">Target Combo</label>
            <select
              className="w-full bg-bg-subtle border border-border rounded-lg p-2.5 text-text-main"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              {combos.map((c) => (
                <option key={c.name} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>
          <Input
            label="Test Prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Enter a message to test your combo routing strategy..."
          />
          <Button onClick={handleTest} loading={loading} fullWidth disabled={!prompt}>Run Strategy</Button>
        </div>
      </Card>

      <Card title="Routing Result">
        <div className="mt-2 bg-bg-subtle border border-border rounded-lg p-4 font-mono text-sm min-h-[200px] whitespace-pre-wrap text-text-main">
          {loading ? "Waiting for response..." : response || "Execute a test to see the response."}
        </div>
      </Card>
    </div>
  );
}
