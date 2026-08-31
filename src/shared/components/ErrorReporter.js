// Global client-side error reporter — captures even the smallest swallowed
// error and ships it to the server journal so nothing is ever invisible.
"use client";

import { useEffect } from "react";

export default function ErrorReporter() {
  useEffect(() => {
    const send = (payload) => {
      try {
        fetch("/api/dashboard/nova/client-log", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
          keepalive: true,
        }).catch(() => {});
      } catch {}
    };

    const onError = (e) => {
      send({
        kind: "error",
        message: e?.message || String(e),
        stack: e?.error?.stack || e?.filename ? `${e.filename}:${e.lineno}:${e.colno}` : "",
        url: window.location.href,
        at: new Date().toISOString(),
      });
    };

    const onRejection = (e) => {
      const r = e?.reason;
      send({
        kind: "unhandledrejection",
        message: r?.message || String(r),
        stack: (r?.stack || "").split("\n").slice(0, 6).join("\n"),
        url: window.location.href,
        at: new Date().toISOString(),
      });
    };

    // Patch fetch to surface silent API errors in console too.
    const origFetch = window.fetch;
    if (!window.__novaFetchPatched) {
      window.__novaFetchPatched = true;
      window.fetch = async (...args) => {
        const res = await origFetch(...args);
        try {
          const u = typeof args[0] === "string" ? args[0] : args[0]?.url || "";
          if (u.includes("/api/dashboard/nova") && !res.ok) {
            const clone = res.clone();
            clone.text().then((t) => {
              console.error("[nova-api]", res.status, u, t.slice(0, 300));
              send({ kind: "api-error", status: res.status, url: u, body: t.slice(0, 500), at: new Date().toISOString() });
            }).catch(() => {});
          }
        } catch {}
        return res;
      };
    }

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
