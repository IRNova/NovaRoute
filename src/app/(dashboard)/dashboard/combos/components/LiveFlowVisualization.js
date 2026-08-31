"use client";
import { useState, useEffect } from "react";
import Card from "@/shared/components/Card";
import Badge from "@/shared/components/Badge";

export default function LiveFlowVisualization({ comboId }) {
  const [flow, setFlow] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!comboId) { setLoading(false); return; }
    fetch(`/api/combos/${comboId}/flow`)
      .then((r) => r.json())
      .then((d) => { setFlow(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [comboId]);

  if (loading) return <Card className="p-5"><p className="text-sm text-text-muted">Loading flow...</p></Card>;
  if (!flow) return null;

  const nodes = flow.nodes || [];
  const edges = flow.edges || [];

  return (
    <Card className="p-5 space-y-4">
      <h3 className="text-sm font-semibold text-text-main">Live Flow Visualization</h3>
      <div className="relative">
        <div className="flex items-center gap-4 overflow-x-auto pb-4">
          {nodes.map((node, i) => (
            <div key={node.id || i} className="flex items-center gap-4 shrink-0">
              <div className={`p-4 rounded-xl border-2 min-w-[140px] text-center transition-all ${
                node.status === "active"
                  ? "border-success bg-success/5 shadow-md"
                  : node.status === "failed"
                  ? "border-danger bg-danger/5"
                  : node.status === "completed"
                  ? "border-primary bg-primary/5"
                  : "border-surface-3"
              }`}>
                <span className="material-symbols-outlined text-[24px] text-primary">
                  {node.type === "model" ? "smart_toy" : node.type === "router" ? "route" : "circle"}
                </span>
                <p className="text-sm font-medium text-text-main mt-1">{node.label || node.model || "—"}</p>
                <Badge variant={node.status === "active" ? "success" : node.status === "failed" ? "danger" : "default"} size="sm">
                  {node.status || "pending"}
                </Badge>
                {node.latencyMs && (
                  <p className="text-xs text-text-muted mt-1">{node.latencyMs}ms</p>
                )}
              </div>
              {i < nodes.length - 1 && (
                <div className="flex items-center">
                  <div className="w-8 h-0.5 bg-surface-3" />
                  <span className="material-symbols-outlined text-[16px] text-text-muted">arrow_forward</span>
                  <div className="w-8 h-0.5 bg-surface-3" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
