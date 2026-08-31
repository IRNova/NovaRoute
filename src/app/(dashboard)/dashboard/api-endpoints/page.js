"use client";
import { useState, useEffect } from "react";
import Card, { CardSkeleton } from "@/shared/components/Card";
import Badge from "@/shared/components/Badge";
import Button from "@/shared/components/Button";
import Input from "@/shared/components/Input";
import Select from "@/shared/components/Select";

const SAMPLE_ENDPOINTS = [
  { method: "POST", path: "/v1/chat/completions", description: "Chat completions (OpenAI-compatible)", authRequired: true, rateLimit: "60/min" },
  { method: "POST", path: "/v1/completions", description: "Text completions endpoint", authRequired: true, rateLimit: "60/min" },
  { method: "POST", path: "/v1/embeddings", description: "Generate text embeddings", authRequired: true, rateLimit: "30/min" },
  { method: "GET", path: "/v1/models", description: "List all available models", authRequired: true, rateLimit: "120/min" },
  { method: "GET", path: "/v1/models/:id", description: "Get details for a specific model", authRequired: true, rateLimit: "120/min" },
  { method: "POST", path: "/v1/images/generations", description: "Generate images from text prompts", authRequired: true, rateLimit: "20/min" },
  { method: "POST", path: "/v1/audio/speech", description: "Text-to-speech synthesis", authRequired: true, rateLimit: "30/min" },
  { method: "POST", path: "/v1/audio/transcriptions", description: "Speech-to-text transcription", authRequired: true, rateLimit: "30/min" },
  { method: "GET", path: "/api/providers", description: "List all configured providers", authRequired: true, rateLimit: "120/min" },
  { method: "GET", path: "/api/health", description: "System health check", authRequired: false, rateLimit: "300/min" },
  { method: "GET", path: "/api/usage/stats", description: "Usage statistics and metrics", authRequired: true, rateLimit: "60/min" },
  { method: "GET", path: "/api/analytics", description: "Analytics data for dashboard", authRequired: true, rateLimit: "60/min" },
  { method: "PUT", path: "/api/providers/:id", description: "Update a provider connection", authRequired: true, rateLimit: "30/min" },
  { method: "DELETE", path: "/api/providers/:id", description: "Delete a provider connection", authRequired: true, rateLimit: "10/min" },
  { method: "POST", path: "/api/tools", description: "Register a new tool", authRequired: true, rateLimit: "10/min" },
  { method: "GET", path: "/api/tools", description: "List registered tools", authRequired: true, rateLimit: "60/min" },
  { method: "POST", path: "/v1/audio/translations", description: "Translate audio to another language", authRequired: true, rateLimit: "20/min" },
  { method: "GET", path: "/dashboard", description: "Dashboard web UI", authRequired: false, rateLimit: "—" },
];

const METHOD_COLORS = {
  GET: "success",
  POST: "primary",
  PUT: "warning",
  DELETE: "error",
};

function EndpointRow({ endpoint }) {
  return (
    <tr className="hover:bg-surface-2/50 transition-colors">
      <td className="p-3">
        <Badge variant={METHOD_COLORS[endpoint.method] || "default"} size="sm">
          {endpoint.method}
        </Badge>
      </td>
      <td className="p-3">
        <span className="font-mono text-sm font-medium text-text-main">{endpoint.path}</span>
      </td>
      <td className="p-3">
        <span className="text-sm text-text-muted">{endpoint.description}</span>
      </td>
      <td className="p-3">
        <Badge variant={endpoint.authRequired ? "warning" : "default"} size="sm" dot>
          {endpoint.authRequired ? "Required" : "Public"}
        </Badge>
      </td>
      <td className="p-3 text-right">
        <span className="font-mono text-xs text-text-muted">{endpoint.rateLimit}</span>
      </td>
    </tr>
  );
}

export default function ApiEndpointsPage() {
  const [endpoints, setEndpoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [methodFilter, setMethodFilter] = useState("all");

  useEffect(() => {
    fetch("/api/api-endpoints")
      .then((r) => r.json())
      .then((d) => setEndpoints(d.endpoints || SAMPLE_ENDPOINTS))
      .catch(() => setEndpoints(SAMPLE_ENDPOINTS))
      .finally(() => setLoading(false));
  }, []);

  const filtered = endpoints.filter((ep) => {
    const matchMethod = methodFilter === "all" || ep.method === methodFilter;
    const matchSearch =
      !search ||
      ep.path.toLowerCase().includes(search.toLowerCase()) ||
      ep.description.toLowerCase().includes(search.toLowerCase());
    return matchMethod && matchSearch;
  });

  const methodCounts = endpoints.reduce((acc, ep) => {
    acc[ep.method] = (acc[ep.method] || 0) + 1;
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-main">API Endpoints</h1>
          <p className="text-sm text-text-muted mt-1">All available routes and their configuration</p>
        </div>
        <Badge variant="default" size="md">{endpoints.length} endpoints</Badge>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-primary">api</span>
            <span className="text-xs font-medium text-text-muted uppercase tracking-wide">Total</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-text-main">{endpoints.length}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-success">circle</span>
            <span className="text-xs font-medium text-text-muted uppercase tracking-wide">GET</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-success">{methodCounts.GET || 0}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-primary">circle</span>
            <span className="text-xs font-medium text-text-muted uppercase tracking-wide">POST</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-primary">{methodCounts.POST || 0}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-warning">circle</span>
            <span className="text-xs font-medium text-text-muted uppercase tracking-wide">PUT / DELETE</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-warning">{(methodCounts.PUT || 0) + (methodCounts.DELETE || 0)}</p>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search endpoints..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select
          options={[
            { value: "all", label: "All Methods" },
            { value: "GET", label: "GET" },
            { value: "POST", label: "POST" },
            { value: "PUT", label: "PUT" },
            { value: "DELETE", label: "DELETE" },
          ]}
          value={methodFilter}
          onChange={(e) => setMethodFilter(e.target.value)}
          className="w-44"
        />
      </div>

      <Card className="overflow-hidden p-0">
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-text-muted">
            {search || methodFilter !== "all" ? "No endpoints match your filters." : "No endpoints registered."}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-text-muted text-xs uppercase">
              <tr>
                <th className="p-3 text-left">Method</th>
                <th className="p-3 text-left">Path</th>
                <th className="p-3 text-left">Description</th>
                <th className="p-3 text-left">Auth Required</th>
                <th className="p-3 text-right">Rate Limit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-3/50">
              {filtered.map((ep, i) => (
                <EndpointRow key={`${ep.method}-${ep.path}-${i}`} endpoint={ep} />
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
