"use client";
import { useState, useEffect } from "react";
import Card, { CardSkeleton } from "@/shared/components/Card";
import Badge from "@/shared/components/Badge";
import Button from "@/shared/components/Button";
import Toggle from "@/shared/components/Toggle";
import Select from "@/shared/components/Select";

const MEDIA_PROVIDERS = [
  { id: "replicate", name: "Replicate", category: "image", models: ["sdxl", "flux", "stable-diffusion"], status: "available" },
  { id: "fal", name: "fal.ai", category: "image", models: ["flux-pro", "ideogram", "playground"], status: "available" },
  { id: "leonardo", name: "Leonardo AI", category: "image", models: ["leonardo-image", "albedo-base"], status: "available" },
  { id: "runway", name: "Runway", category: "video", models: ["gen-3-alpha", "gen-2"], status: "available" },
  { id: "pika", name: "Pika Labs", category: "video", models: ["pika-1.0", "pika-2.0"], status: "available" },
  { id: "elevenlabs", name: "ElevenLabs", category: "tts", models: ["eleven-turbo", "eleven-multilingual"], status: "available" },
  { id: "deepgram", name: "Deepgram", category: "stt", models: ["nova-2", "whisper-large"], status: "available" },
  { id: "suno", name: "Suno AI", category: "music", models: ["suno-v3", "suno-v4"], status: "available" },
  { id: "udio", name: "Udio", category: "music", models: ["udio-v1", "udio-v2"], status: "available" },
  { id: "searchapi", name: "SearchAPI", category: "web", models: ["google-search", "bing-search"], status: "available" },
  { id: "tavily", name: "Tavily", category: "web", models: ["tavily-search", "tavily-extract"], status: "available" },
  { id: "firecrawl", name: "Firecrawl", category: "web", models: ["firecrawl-scrape", "firecrawl-crawl"], status: "available" },
];

export default function MediaProvidersPage() {
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/media-providers")
      .then((r) => r.json())
      .then((d) => { setProviders(d.providers || MEDIA_PROVIDERS); setLoading(false); })
      .catch(() => { setProviders(MEDIA_PROVIDERS); setLoading(false); });
  }, []);

  if (loading) return <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4"><CardSkeleton /><CardSkeleton /><CardSkeleton /></div>;

  const categories = [...new Set(providers.map((p) => p.category))];
  const filtered = providers.filter((p) => {
    if (filter !== "all" && p.category !== filter) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-main">Media Providers</h1>
        <p className="text-sm text-text-muted mt-1">Image, video, audio, music, and web search providers</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <input placeholder="Search providers..." value={search} onChange={(e) => setSearch(e.target.value)} className="flex-1 min-w-[200px] py-2.5 px-3 bg-surface-2 border border-surface-3 rounded-xl text-sm text-text-main" />
        <div className="flex gap-1">
          <button onClick={() => setFilter("all")} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${filter === "all" ? "bg-primary/10 text-primary" : "text-text-muted hover:bg-surface-2"}`}>All</button>
          {categories.map((c) => (
            <button key={c} onClick={() => setFilter(c)} className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize ${filter === c ? "bg-primary/10 text-primary" : "text-text-muted hover:bg-surface-2"}`}>{c}</button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((p) => (
          <Card key={p.id} className="p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-text-main">{p.name}</span>
              <Badge variant="primary" size="sm">{p.category}</Badge>
            </div>
            <div className="flex flex-wrap gap-1 mb-3">
              {p.models.map((m) => (
                <Badge key={m} size="sm">{m}</Badge>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <Badge variant="success" size="sm">{p.status}</Badge>
              <Button size="sm" variant="outline">Configure</Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
