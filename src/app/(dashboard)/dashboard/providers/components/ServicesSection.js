"use client";
import { useState, useEffect } from "react";
import Card from "@/shared/components/Card";
import Badge from "@/shared/components/Badge";
import Button from "@/shared/components/Button";
import Toggle from "@/shared/components/Toggle";

const SERVICES = [
  {
    id: "ninerouter",
    name: "NineRouter",
    icon: "router",
    description: "Multi-provider routing proxy with failover",
    url: "https://9router.dev",
  },
  {
    id: "mux",
    name: "Mux",
    icon: "cable",
    description: "Connection pooling and load balancing",
    url: "https://mux.dev",
  },
  {
    id: "bifrost",
    name: "Bifrost",
    icon: "swap_horiz",
    description: "Universal API gateway for AI providers",
    url: "https://bifrost.sh",
  },
];

export default function ServicesSection() {
  const [statuses, setStatuses] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkServices = async () => {
      const results = {};
      for (const svc of SERVICES) {
        try {
          const res = await fetch(`/api/services/${svc.id}/status`);
          results[svc.id] = await res.json();
        } catch {
          results[svc.id] = { active: false, error: "unreachable" };
        }
      }
      setStatuses(results);
      setLoading(false);
    };
    checkServices();
  }, []);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-[20px] text-text-muted">dns</span>
        <h2 className="text-base font-semibold text-text-main">Services</h2>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SERVICES.map((svc) => {
          const status = statuses[svc.id];
          return (
            <Card key={svc.id} className="p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[24px] text-primary">{svc.icon}</span>
                  <span className="font-medium text-text-main">{svc.name}</span>
                </div>
                <Badge variant={status?.active ? "success" : "default"} size="sm">
                  {loading ? "..." : status?.active ? "Active" : "Inactive"}
                </Badge>
              </div>
              <p className="text-xs text-text-muted mb-3">{svc.description}</p>
              <div className="flex items-center justify-between">
                <a
                  href={svc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline"
                >
                  Documentation
                </a>
                <Button size="sm" variant="ghost">
                  Configure
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
