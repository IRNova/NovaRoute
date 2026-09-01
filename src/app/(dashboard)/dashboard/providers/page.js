"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  CardSkeleton,
  Button,
  Badge,
  Modal,
  SegmentedControl,
} from "@/shared/components";
import {
  AI_PROVIDERS,
  getProviderAlias,
  isOpenAICompatibleProvider,
  isAnthropicCompatibleProvider,
  resolveDisplayAuthType,
} from "@/shared/constants/providers";
import { getModelsByProviderId } from "@/shared/constants/models";
import { useHeaderSearchStore } from "@/store/headerSearchStore";
import { useNotificationStore } from "@/store/notificationStore";
import useEmailPrivacyStore from "@/store/emailPrivacyStore";
import AddCompatibleModal from "./components/AddCompatibleModal";
import AddCustomEmbeddingModal from "@/shared/components/AddCustomEmbeddingModal";
import ProviderCard from "./components/ProviderCard";
import ProviderEditModal from "./components/ProviderEditModal";
import OnboardingWizard from "./components/OnboardingWizard";
import ImportProvidersModal from "./components/ImportProvidersModal";
import DefaultModelsSection from "./components/DefaultModelsSection";
import { getProviderState, STATUS_META } from "./components/providerStatus";
import { translate } from "@/i18n/runtime";

const GROUP_META = [
  { id: "none", label: "No Key Needed", icon: "lock_open", size: "sm", hint: "Providers that work without any credential" },
  { id: "apikey", label: "API Key", icon: "key", size: "lg", hint: "Providers using API key authentication" },
  { id: "oauth", label: "Account Login", icon: "login", size: "lg", hint: "Providers using OAuth / device code login" },
  { id: "cookie", label: "Cookie", icon: "cookie", size: "sm", hint: "Providers using browser session cookies" },
  { id: "cli", label: "CLI / IDE", icon: "terminal", size: "sm", hint: "Local CLI tools and IDE plugins" },
  { id: "local", label: "Local", icon: "computer", size: "sm", hint: "Self-hosted local inference servers" },
  { id: "compatible", label: "Compatible", icon: "extension", size: "sm", hint: "User-configured compatible endpoints" },
];

const OPENAI_COMPATIBLE_COLOR = "#10A37F";
const ANTHROPIC_COMPATIBLE_COLOR = "#D97757";

const DISPLAY_MODE_KEY = "novaroute-providers-display-mode";

const DISPLAY_MODES = [
  { value: "all", label: "All" },
  { value: "configured", label: "Configured" },
  { value: "compact", label: "Compact" },
  { value: "list", label: "List" },
  { value: "byauth", label: "By Auth" },
];

function readDisplayMode() {
  if (typeof window === "undefined") return "all";
  try {
    const stored = window.localStorage.getItem(DISPLAY_MODE_KEY);
    return stored || "all";
  } catch {
    return "all";
  }
}

export default function ProvidersPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { emailsVisible, setEmailsVisible } = useEmailPrivacyStore();
  const [connections, setConnections] = useState([]);
  const [providerNodes, setProviderNodes] = useState([]);
  const [disabledModels, setDisabledModels] = useState({});
  const [customModels, setCustomModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [testingSet, setTestingSet] = useState(() => new Set());
  const [localRuntimes, setLocalRuntimes] = useState(null);
  const [connectingLocal, setConnectingLocal] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [showAddOpenaiCompatible, setShowAddOpenaiCompatible] = useState(false);
  const [showAddAnthropicCompatible, setShowAddAnthropicCompatible] = useState(false);
  const [showAddCustomEmbedding, setShowAddCustomEmbedding] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showImport, setShowImport] = useState(false);
  // Start with a stable SSR-safe default and sync from URL/localStorage on the
  // client to avoid hydration mismatches (server never reads localStorage).
  const [displayMode, setDisplayMode] = useState("all");
  const VALID_AUTH_FILTERS = ["all", "apikey", "oauth", "cookie", "cli", "free", "local"];
  useEffect(() => {
    const view = searchParams.get("view");
    if (view && DISPLAY_MODES.some((m) => m.value === view)) {
      setDisplayMode(view);
    }
    const cat = searchParams.get("cat");
    if (cat && VALID_AUTH_FILTERS.includes(cat)) {
      setAuthFilter(cat);
    }
    if (!view) {
      const stored = readDisplayMode();
      if (stored && DISPLAY_MODES.some((m) => m.value === stored)) {
        setDisplayMode(stored);
      }
    }
  }, [searchParams]);
  const [authFilter, setAuthFilter] = useState("all"); // "all" | "apikey" | "oauth" | "cookie" | "cli" | "free" | "local"
  const [groupTesting, setGroupTesting] = useState(null);
  const [testingProgress, setTestingProgress] = useState(null);
  const [testingAll, setTestingAll] = useState(false);
  const [batchResults, setBatchResults] = useState(null);
  const notify = useNotificationStore();
  const searchQuery = useHeaderSearchStore((s) => s.query);
  const setSearchQuery = useHeaderSearchStore((s) => s.setQuery);
  const registerSearch = useHeaderSearchStore((s) => s.register);
  const unregisterSearch = useHeaderSearchStore((s) => s.unregister);

  useEffect(() => {
    registerSearch("Search providers...");
    return () => unregisterSearch();
  }, [registerSearch, unregisterSearch]);

  // Deep-link support: /dashboard/providers#image scrolls to that category.
  useEffect(() => {
    const scrollToHash = () => {
      if (typeof window === "undefined") return;
      const hash = window.location.hash;
      if (!hash) return;
      document
        .getElementById(hash.slice(1))
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    if (!loading) scrollToHash();
    window.addEventListener("hashchange", scrollToHash);
    return () => window.removeEventListener("hashchange", scrollToHash);
  }, [loading]);

  // URL-based display mode persistence
  const updateDisplayMode = useCallback((mode) => {
    setDisplayMode(mode);
    try { localStorage.setItem(DISPLAY_MODE_KEY, mode); } catch {}
    const params = new URLSearchParams(window.location.search);
    if (mode === "all") { params.delete("view"); } else { params.set("view", mode); }
    router.push(`?${params.toString()}`, { scroll: false });
  }, [router]);

  // URL-based auth filter persistence
  const updateAuthFilter = useCallback((filter) => {
    setAuthFilter(filter);
    const params = new URLSearchParams(window.location.search);
    if (filter === "all") { params.delete("cat"); } else { params.set("cat", filter); }
    router.push(`?${params.toString()}`, { scroll: false });
  }, [router]);

  const fetchAll = async () => {
    try {
      const [connectionsRes, nodesRes, disabledRes, customRes] = await Promise.all([
        fetch("/api/providers"),
        fetch("/api/provider-nodes"),
        fetch("/api/models/disabled"),
        fetch("/api/models/custom"),
      ]);
      const connectionsData = await connectionsRes.json();
      const nodesData = await nodesRes.json();
      const disabledData = await disabledRes.json();
      const customData = await customRes.json();
      if (connectionsRes.ok) setConnections(connectionsData.connections || []);
      if (nodesRes.ok) setProviderNodes(nodesData.nodes || []);
      if (disabledRes.ok) setDisabledModels(disabledData.disabled || {});
      if (customRes.ok) setCustomModels(customData.models || []);
    } catch (error) {
      console.log("Error fetching provider data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const load = async () => {
      await fetchAll();
    };
    load();
  }, []);

  // Persist display-mode preference
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (displayMode === "all") {
        window.localStorage.removeItem(DISPLAY_MODE_KEY);
      } else {
        window.localStorage.setItem(DISPLAY_MODE_KEY, displayMode);
      }
    } catch {
      // ignore storage errors
    }
  }, [displayMode]);

  const handleTestGroup = async (groupId) => {
    if (groupTesting) return;
    const group = groups.find((g) => g.id === groupId);
    if (!group) return;
    const targets = group.providers.filter((p) =>
      connections.some((c) => c.provider === p.id)
    );
    if (targets.length === 0) {
      notify.info("No configured connections in this group");
      return;
    }

    setGroupTesting(groupId);
    setTestingProgress({ current: 0, total: targets.length });
    setBatchResults(null);
    const results = [];
    for (let i = 0; i < targets.length; i += 1) {
      const p = targets[i];
      try {
        const res = await fetch("/api/providers/test-batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "provider", providerId: p.id }),
        });
        const data = await res.json();
        for (const r of data.results || []) {
          results.push({ ...r, providerLabel: p.name });
        }
      } catch (error) {
        results.push({
          providerLabel: p.name,
          connectionName: p.name,
          valid: false,
          latencyMs: 0,
          error: error.message || "Test request failed",
        });
      }
      setTestingProgress({ current: i + 1, total: targets.length });
    }
    setGroupTesting(null);
    setTestingProgress(null);
    const summary = {
      total: results.length,
      passed: results.filter((r) => r.valid === true).length,
      failed: results.filter((r) => r.valid === false).length,
      // A provider with no probe is not a failed provider.
      unknown: results.filter((r) => r.valid === null || r.unknown).length,
    };
    setBatchResults({ results, summary, groupLabel: group.label });
    const skipped = summary.unknown ? `, ${summary.unknown} could not be tested` : "";
    if (summary.failed === 0) notify.success(`All testable connections passed${skipped}`);
    else notify.warning(`${summary.passed} passed, ${summary.failed} failed${skipped}`);
    await fetchAll();
  };

  const handleTestAll = async () => {
    if (testingAll) return;
    setTestingAll(true);
    try {
      const res = await fetch("/api/providers/test-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "all" }),
      });
      const data = await res.json();
      if (data.summary) {
        setBatchResults({ results: data.results || [], summary: data.summary, groupLabel: "All providers" });
        if (data.summary.failed === 0) notify.success("All connections passed");
        else notify.warning(`${data.summary.passed} passed, ${data.summary.failed} failed`);
      } else {
        notify.error(data.error || "Test failed");
      }
      await fetchAll();
    } catch {
      notify.error("Test request failed");
    } finally {
      setTestingAll(false);
    }
  };

  const matchSearch = (name) =>
    !searchQuery.trim() ||
    name.toLowerCase().includes(searchQuery.trim().toLowerCase());

  // Build auth-based groups. Each provider lands in its first matching
  // auth group so nothing is listed twice, and every provider is shown.
  const groups = (() => {
    const used = new Set();
    const build = [];

    for (const meta of GROUP_META) {
      const entries = [];

      if (meta.id === "compatible") {
        // User-configured compatible nodes (OpenAI, Anthropic, Custom Embedding)
        for (const node of providerNodes) {
          if (used.has(node.id)) continue;
          used.add(node.id);
          const isAnthropic = node.type === "anthropic-compatible";
          const isEmbedding = node.type === "custom-embedding";
          entries.push({
            id: node.id,
            name: node.name || (isEmbedding ? "Custom Embedding" : isAnthropic ? "Anthropic Compatible" : "OpenAI Compatible"),
            color: isEmbedding ? "#7C3AED" : isAnthropic ? ANTHROPIC_COMPATIBLE_COLOR : OPENAI_COMPATIBLE_COLOR,
            textIcon: isEmbedding ? "EM" : isAnthropic ? "AC" : "OC",
            apiType: node.apiType,
            isCompatible: true,
            isAnthropic,
          });
        }
      } else {
        // Auth-based groups: collect providers whose displayAuthType matches
        for (const [id, p] of Object.entries(AI_PROVIDERS)) {
          if (used.has(id)) continue;
          // Registry-hidden entries (duplicates of canonical cards, or flows
          // without a connect handler yet) never render as dashboard cards.
          if (p.hidden) continue;
          const authType = resolveDisplayAuthType(id, p);
          if (authType === meta.id) {
            used.add(id);
            entries.push(p);
          }
        }
        // Also add compatible nodes that were already collected above
        for (const node of providerNodes) {
          if (used.has(node.id)) continue;
          // Check if this compatible node's auth type matches the current group
          const nodeAuthType = "compatible";
          if (nodeAuthType === meta.id) {
            used.add(node.id);
            const isAnthropic = node.type === "anthropic-compatible";
            entries.push({
              id: node.id,
              name: node.name || (isAnthropic ? "Anthropic Compatible" : "OpenAI Compatible"),
              color: isAnthropic ? ANTHROPIC_COMPATIBLE_COLOR : OPENAI_COMPATIBLE_COLOR,
              textIcon: isAnthropic ? "AC" : "OC",
              apiType: node.apiType,
              isCompatible: true,
              isAnthropic,
            });
          }
        }
      }

      build.push({ ...meta, providers: entries });
    }

    // Put any remaining compatible nodes into the compatible group
    for (const node of providerNodes) {
      if (used.has(node.id)) continue;
      used.add(node.id);
      const isAnthropic = node.type === "anthropic-compatible";
      const compatGroup = build.find(g => g.id === "compatible");
      if (compatGroup) {
        compatGroup.providers.push({
          id: node.id,
          name: node.name || (isAnthropic ? "Anthropic Compatible" : "OpenAI Compatible"),
          color: isAnthropic ? ANTHROPIC_COMPATIBLE_COLOR : OPENAI_COMPATIBLE_COLOR,
          textIcon: isAnthropic ? "AC" : "OC",
          apiType: node.apiType,
          isCompatible: true,
          isAnthropic,
        });
      }
    }

    return build;
  })();

  const countActiveModels = (providerId, info) => {
    if (
      info.passthroughModels ||
      isOpenAICompatibleProvider(providerId) ||
      isAnthropicCompatibleProvider(providerId)
    )
      return -1;
    const alias = getProviderAlias(providerId) || providerId;
    const disabled = new Set(disabledModels[alias] || []);
    const models = getModelsByProviderId(providerId) || [];
    let count = 0;
    for (const m of models) {
      if (disabled.has(m.id)) count += 0;
      else count += 1;
    }
    const custom = customModels.filter(
      (cm) => cm.providerAlias === alias
    ).length;
    return count + custom;
  };

  const handleToggleProvider = async (providerId, newActive) => {
    const providerConns = connections.filter((c) => c.provider === providerId);
    setConnections((prev) =>
      prev.map((c) =>
        c.provider === providerId ? { ...c, isActive: newActive } : c
      )
    );
    const results = await Promise.allSettled(
      providerConns.map((c) =>
        fetch(`/api/providers/${c.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: newActive }),
        })
      )
    );
    // If any save failed the optimistic flip above is a lie — surface it and
    // resync from the server instead of silently reverting on the next refetch.
    const failed = results.some(
      (r) => r.status === "rejected" || !(r.value && r.value.ok)
    );
    if (failed) {
      notify.error("Failed to save provider state");
      await fetchAll();
    }
  };

  const handleToggleConnection = (id, isActive) => {
    setConnections((prev) =>
      prev.map((c) => (c.id === id ? { ...c, isActive } : c))
    );
    fetch(`/api/providers/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive }),
    });
  };

  const handleTestProvider = async (providerId) => {
    if (testingSet.has(providerId)) return;
    setTestingSet((prev) => new Set(prev).add(providerId));
    try {
      const res = await fetch("/api/providers/test-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "provider", providerId }),
      });
      const data = await res.json();
      if (data.summary) {
        const { passed, failed } = data.summary;
        if (failed === 0) notify.success("Test passed");
        else notify.warning(`${passed} passed, ${failed} failed`);
      } else {
        notify.error(data.error || "Test failed");
      }
      await fetchAll();
    } catch {
      notify.error("Test request failed");
    } finally {
      setTestingSet((prev) => {
        const next = new Set(prev);
        next.delete(providerId);
        return next;
      });
    }
  };

  // Auto-detect locally installed AI runtimes (ollama, llamacpp, vllm…)
  // AND auto-connect any detected-but-unconnected runtime once, so the card
  // shows green/Connected with its live model list — no manual step needed.
  const autoConnectDoneRef = useRef(false);
  const loadLocalRuntimes = useCallback(async () => {
    try {
      const res = await fetch("/api/local-runtimes", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      const detections = data.detections || [];
      setLocalRuntimes(detections);

      if (!autoConnectDoneRef.current && Array.isArray(data.detections)) {
        autoConnectDoneRef.current = true;
        const missing = detections.filter((d) => !data.connected?.[d.providerId]);
        for (const d of missing) {
          try {
            await fetch("/api/providers", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ provider: d.providerId, name: d.label + " (local)", apiKey: "" }),
            });
          } catch { /* next */ }
        }
        if (missing.length > 0) {
          await fetchAll();
          // second pass so the panel reflects the new connected state
          const r2 = await fetch("/api/local-runtimes", { cache: "no-store" });
          if (r2.ok) setLocalRuntimes((await r2.json()).detections || []);
        }
      }
    } catch { /* ignore */ }
  }, []);
  useEffect(() => { loadLocalRuntimes(); }, [loadLocalRuntimes]);

  const handleConnectLocal = async (d) => {
    if (connectingLocal) return;
    setConnectingLocal(d.providerId);
    try {
      await fetch("/api/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: d.providerId, name: d.label + " (local)", apiKey: "" }),
      });
      await fetchAll();
      await loadLocalRuntimes();
      notify.success("Connected to " + d.label);
    } catch { notify.error("Failed to connect local runtime"); }
    finally { setConnectingLocal(null); }
  };

  const handleTestLocalModel = async (providerId, modelId) => {
    const conn = connections.find((c) => c.provider === providerId);
    if (!conn) { notify.error("No connection"); return; }
    notify.info("Testing " + modelId + "…");
    try {
      const res = await fetch("/api/providers/test-models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: conn.provider, apiKey: conn.apiKey, models: [{ id: modelId, name: modelId }] }),
      });
      const data = await res.json();
      const r = (data.results || [])[0];
      if (r && r.ok) notify.success(modelId + ": OK (" + (r.latencyMs || 0) + "ms)");
      else notify.error(modelId + ": " + ((r && r.error) || data.error || "failed"));
    } catch { notify.error("Test request failed"); }
  };

  const handleSaveApiKey = async (formData) => {
    const res = await fetch("/api/providers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: editTarget.providerId, ...formData }),
    });    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    if (!res.ok) {
      const err = new Error(data?.error || "Failed to save connection");
      err.message = err.message;
      throw err;
    }
    await fetchAll();
  };

  const handleUpdateConnection = async (formData, connectionId) => {
    const res = await fetch(`/api/providers/${connectionId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    });
    if (!res.ok) throw new Error("Failed to update connection");
    await fetchAll();
  };

  const handleDeleteConnection = async (id) => {
    const res = await fetch(`/api/providers/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to delete connection");
    await fetchAll();
  };

  const openEdit = (providerId, info) => {
    setEditTarget({
      providerId,
      info,
      isCompatible: !!info.isCompatible || isOpenAICompatibleProvider(providerId) || isAnthropicCompatibleProvider(providerId),
      isAnthropic: info.isAnthropic || isAnthropicCompatibleProvider(providerId),
    });
  };

  const summary = (() => {
    const counts = { connected: 0, broken: 0, exhausted: 0, notConnected: 0, disabled: 0 };
    for (const g of groups) {
      for (const p of g.providers) {
        const { state } = getProviderState(p.id, connections);
        counts[state] = (counts[state] || 0) + 1;
      }
    }
    return counts;
  })();

  const allGroups = groups
    .map((g) => {
      let visible = g.providers
        .filter((p) => matchSearch(p.name))
        .filter((p) => displayMode !== "configured" || connections.some((c) => c.provider === p.id));

      // When a specific auth filter is selected, only show that group
      if (authFilter !== "all") {
        visible = visible.filter((p) => resolveDisplayAuthType(p.id, p) === authFilter);
      }

      return { ...g, providers: visible };
    })
    // Keep the compatible group rendered even with zero nodes — its header
    // hosts the only "+ OpenAI / + Anthropic" entry points. Hiding it on a
    // fresh install made custom providers impossible to add (chicken-and-egg).
    .filter(
      (g) =>
        g.providers.length > 0 ||
        (g.id === "compatible" && !searchQuery.trim() && authFilter === "all")
    );

  const renderGroup = (group) => {
    const isLg = group.size === "lg";
    const gridCls = isLg
      ? "grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
      : "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4";
    const hasConfigured = group.providers.some((p) =>
      connections.some((c) => c.provider === p.id)
    );

    return (
      <section key={group.id} id={group.id} className="flex scroll-mt-24 flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-text-muted">
              {group.icon}
            </span>
            <div className="min-w-0 w-full">
              <h2 className="truncate text-base font-semibold text-text-main text-right">
                {translate(group.label)}
              </h2>
              {group.hint && (
                <p className="truncate text-xs text-text-muted text-right">{translate(group.hint)}</p>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {group.id === "compatible" && (
              <>
                <Button variant="ghost" size="sm" onClick={() => setShowAddOpenaiCompatible(true)}>
                  + OpenAI
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowAddAnthropicCompatible(true)}>
                  + Anthropic
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowAddCustomEmbedding(true)}>
                  + Custom Embedding
                </Button>
              </>
            )}
            {hasConfigured && (
              <Button
                variant="secondary"
                size="sm"
                icon="play_arrow"
                onClick={() => handleTestGroup(group.id)}
                disabled={groupTesting === group.id}
              >
                {groupTesting === group.id
                  ? `Testing ${testingProgress?.current}/${testingProgress?.total}...`
                  : "Test All"}
              </Button>
            )}
            <Badge variant="default" size="sm">
              {group.providers.length}
            </Badge>
          </div>
        </div>
        {group.id === "compatible" && group.providers.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-4 py-8 text-center">
            <span className="material-symbols-outlined text-[28px] text-text-muted">
              add_circle
            </span>
            <p className="max-w-md text-sm text-text-muted">
              {translate(
                "No custom providers yet. Use the + OpenAI / + Anthropic buttons above to connect any compatible endpoint by base URL and API key."
              )}
            </p>
          </div>
        )}
        {displayMode === "compact" ? (
          <div className="flex flex-col divide-y divide-black/[0.03] overflow-hidden rounded-xl border border-border bg-surface dark:divide-white/[0.03]">
            {group.providers.map((p) => {
              const state = getProviderState(p.id, connections).state;
              const providerHasConnections = connections.some((c) => c.provider === p.id);
              const meta = STATUS_META[state] || STATUS_META.notConnected;
              const modelCount = countActiveModels(p.id, p);
              const isBrokenOrDisabled = state === "broken" || state === "exhausted" || state === "disabled";
              return (
                <div key={p.id} className={`flex min-w-0 items-center justify-between gap-3 px-3 py-2 ${isBrokenOrDisabled ? "opacity-60" : ""}`}>
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className={`size-2.5 shrink-0 rounded-full ${meta.dot}`} />
                    <span
                      className="truncate text-sm font-medium text-text-main"
                      title={p.name}
                    >
                      {p.name}
                    </span>
                    <span className="shrink-0 text-xs text-text-muted">{translate(meta.label)}</span>
                    {modelCount >= 0 && (
                      <span className="hidden shrink-0 text-xs text-text-muted sm:inline">
                        {modelCount} {translate("models")}
                      </span>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {providerHasConnections && (
                      <button
                        onClick={() => handleTestProvider(p.id)}
                        disabled={testingSet.has(p.id)}
                        title="Test connection"
                        className="rounded p-1.5 text-text-muted transition-colors hover:bg-black/5 hover:text-primary disabled:opacity-50 dark:hover:bg-white/5"
                      >
                        <span className={`material-symbols-outlined text-[18px] ${testingSet.has(p.id) ? "animate-spin" : ""}`}>
                          {testingSet.has(p.id) ? "progress_activity" : "play_arrow"}
                        </span>
                      </button>
                    )}
                    <button
                      onClick={() => openEdit(p.id, p)}
                      title="Edit provider"
                      className="rounded p-1.5 text-text-muted transition-colors hover:bg-black/5 hover:text-primary dark:hover:bg-white/5"
                    >
                      <span className="material-symbols-outlined text-[18px]">edit</span>
                    </button>
                    {providerHasConnections ? (
                      <button
                        onClick={() => handleToggleProvider(p.id, state === "disabled")}
                        title={state === "disabled" ? "Enable provider" : "Disable provider"}
                        className={`rounded p-1.5 transition-colors hover:bg-black/5 dark:hover:bg-white/5 ${
                          state === "disabled" ? "text-text-muted" : "text-primary"
                        }`}
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          {state === "disabled" ? "toggle_off" : "toggle_on"}
                        </span>
                      </button>
                    ) : (
                      <span
                        title="Connect this provider first"
                        className="cursor-not-allowed rounded p-1.5 text-text-muted opacity-40"
                      >
                        <span className="material-symbols-outlined text-[18px]">toggle_on</span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className={gridCls}>
            {group.providers.map((p) => {
              const state = getProviderState(p.id, connections).state;
              const modelCount = countActiveModels(p.id, p);
              return (
                <ProviderCard
                  key={p.id}
                  providerId={p.id}
                  provider={p}
                  state={state}
                  modelCount={modelCount}
                  size={isLg ? "lg" : "sm"}
                  testing={testingSet.has(p.id)}
                  hasConnections={connections.some((c) => c.provider === p.id)}
                  onEdit={() => openEdit(p.id, p)}
                  onToggle={(next) => handleToggleProvider(p.id, next)}
                  onTest={connections.some((c) => c.provider === p.id) ? () => handleTestProvider(p.id) : undefined}
                  localRuntime={Array.isArray(localRuntimes) ? (localRuntimes.find((d) => d.providerId === p.id) || null) : null}
                  onTestLocalModel={(modelId) => handleTestLocalModel(p.id, modelId)}
                />
              );
            })}
          </div>
        )}
      </section>
    );
  };

  const localPanel = Array.isArray(localRuntimes) && localRuntimes.length > 0 ? (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="material-symbols-outlined text-primary text-[18px]">radar</span>
        <h3 className="text-sm font-semibold text-text-main">{translate("Detected local runtimes")}</h3>
        <span className="text-xs text-text-muted ms-auto">{translate("auto-detected on this server")}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {localRuntimes.map((d) => {
          const isConnected = connections.some((c) => c.provider === d.providerId);
          return (
            <div key={d.providerId} className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface-2/50 px-3 py-2 text-xs">
              <span className="size-2 rounded-full bg-green-500" />
              <span className="font-medium text-text-main">{d.label}</span>
              <code className="text-[10px] text-text-muted hidden sm:inline">{d.baseUrl}</code>
              <span className="text-text-muted">· {d.modelCount} {translate("models")}</span>
              {isConnected ? (
                <Badge variant="success" size="sm">{translate("Connected")}</Badge>
              ) : (
                <Button size="sm" variant="primary" onClick={() => handleConnectLocal(d)} disabled={connectingLocal === d.providerId}>
                  {connectingLocal === d.providerId ? translate("Connecting...") : translate("Connect")}
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  ) : null;

  const legend = [
    { meta: STATUS_META.connected, label: "Active — API connected" },
    { meta: STATUS_META.exhausted, label: "Token quota exhausted" },
    { meta: STATUS_META.broken, label: "Connection down" },
    { meta: STATUS_META.notConnected, label: "Not connected" },
    { meta: STATUS_META.disabled, label: "Disabled" },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-text-main">{translate("Providers")}</h1>
            <p className="text-sm text-text-muted">
              {translate("Every provider on one page — grouped by authentication method, nothing hidden.")}
            </p>
          </div>
        </div>
        {/* Search bar */}
        <div className="relative">
          <span className="absolute inset-y-0 start-0 flex items-center ps-3 pointer-events-none text-text-muted">
            <span className="material-symbols-outlined text-[20px]">search</span>
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={translate("Search providers...")}
            className="w-full ps-10 pe-4 py-2.5 rounded-xl border border-border bg-surface text-sm text-text-main placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
          />
        </div>
        {/* Auth type filter */}
        <div className="flex flex-wrap items-center gap-2">
          {[
            { value: "all", label: "All", icon: "apps" },
            { value: "apikey", label: "API Key", icon: "key" },
            { value: "oauth", label: "Account Login", icon: "login" },
            { value: "cookie", label: "Cookie", icon: "cookie" },
            { value: "cli", label: "CLI", icon: "terminal" },
            { value: "local", label: "Local", icon: "computer" },
          ].map((f) => (
            <button
              key={f.value}
              onClick={() => updateAuthFilter(f.value)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                authFilter === f.value
                  ? "bg-primary text-white"
                  : "bg-surface border border-border text-text-muted hover:bg-surface-2"
              }`}
            >
              <span className="material-symbols-outlined text-[14px]">{f.icon}</span>
              {translate(f.label)}
            </button>
          ))}
        </div>
        {localPanel}
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2">
          <SegmentedControl
            options={DISPLAY_MODES}
            value={displayMode}
            onChange={updateDisplayMode}
            size="sm"
          />
          <div className="h-5 w-px bg-border mx-1 hidden sm:block" />
          <button
            onClick={() => setEmailsVisible(!emailsVisible)}
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium text-text-muted hover:bg-surface-2 transition-colors"
            title={emailsVisible ? translate("Hide email addresses") : translate("Show email addresses")}
          >
            <span className="material-symbols-outlined text-[16px]">{emailsVisible ? "visibility" : "visibility_off"}</span>
            {emailsVisible ? translate("Emails Visible") : translate("Emails Hidden")}
          </button>
          <Button variant="ghost" size="sm" icon="school" onClick={() => setShowOnboarding(true)}>
            {translate("Setup Wizard")}
          </Button>
          <Button variant="ghost" size="sm" icon="upload" onClick={() => setShowImport(true)}>
            {translate("Import")}
          </Button>
          <div className="ms-auto flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              icon={testingAll ? "progress_activity" : "play_arrow"}
              onClick={handleTestAll}
              disabled={testingAll}
            >
              {testingAll ? translate("Testing All...") : translate("Test All")}
            </Button>
          </div>
        </div>
        {/* Status legend */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-xs">
          <span className="font-semibold text-text-main">{translate("Status")}:</span>
          {legend.map(({ meta, label }) => (
            <span key={label} className="inline-flex items-center gap-1.5 text-text-muted">
              <span className={`size-2.5 rounded-full ${meta.dot}`} />
              {translate(label)}
            </span>
          ))}
          <span className="ms-auto inline-flex items-center gap-1.5 text-text-muted">
            <span className="tabular-nums font-semibold text-text-main">
              {Object.values(summary).reduce((a, b) => a + b, 0)}
            </span>
            {translate("providers")}
            <span className="text-text-muted">·</span>
            <span className="tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">
              {summary.connected}
            </span>
            {translate("active")}
            <span className="text-text-muted">·</span>
            <span className="tabular-nums font-semibold text-red-600 dark:text-red-400">
              {summary.exhausted}
            </span>
            {translate("exhausted")}
            <span className="text-text-muted">·</span>
            <span className="tabular-nums font-semibold text-amber-600 dark:text-amber-400">
              {summary.broken}
            </span>
            {translate("down")}
          </span>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <CardSkeleton key={i} className="h-36" />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {allGroups.length === 0 && (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-12 text-center">
              <span className="material-symbols-outlined text-[36px] text-text-muted">
                search_off
              </span>
              <p className="text-sm text-text-muted">{translate("No providers match your search.")}</p>
            </div>
          )}
          {allGroups.map(renderGroup)}
        </div>
      )}

      {editTarget && (
        <ProviderEditModal
          isOpen={!!editTarget}
          onClose={() => setEditTarget(null)}
          providerId={editTarget.providerId}
          providerInfo={editTarget.info}
          connections={connections.filter((c) => c.provider === editTarget.providerId)}
          proxyPools={[]}
          isCompatible={editTarget.isCompatible}
          isAnthropic={editTarget.isAnthropic}
          onSaveApiKey={handleSaveApiKey}
          onBulkDone={fetchAll}
          onUpdateConnection={handleUpdateConnection}
          onDeleteConnection={handleDeleteConnection}
          onToggleConnection={handleToggleConnection}
        />
      )}

      <AddCompatibleModal
        variant="openai"
        isOpen={showAddOpenaiCompatible}
        onClose={() => setShowAddOpenaiCompatible(false)}
        onCreated={fetchAll}
      />
      <AddCompatibleModal
        variant="anthropic"
        isOpen={showAddAnthropicCompatible}
        onClose={() => setShowAddAnthropicCompatible(false)}
        onCreated={fetchAll}
      />
      <AddCustomEmbeddingModal
        isOpen={showAddCustomEmbedding}
        onClose={() => setShowAddCustomEmbedding(false)}
        onCreated={fetchAll}
      />

      <OnboardingWizard
        isOpen={showOnboarding}
        onClose={() => setShowOnboarding(false)}
        onComplete={fetchAll}
      />

      <ImportProvidersModal
        isOpen={showImport}
        onClose={() => setShowImport(false)}
        onImported={fetchAll}
      />

      {batchResults && (
        <Modal
          isOpen
          onClose={() => setBatchResults(null)}
          title={`${translate("Test Results")} — ${batchResults.groupLabel || translate("Providers")}`}
        >
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3 rounded-lg bg-black/[0.03] px-3 py-2 text-xs text-text-muted dark:bg-white/[0.05]">
              <span className="tabular-nums font-semibold text-text-main">{translate("Total")}: {batchResults.summary.total}</span>
              <span className="tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">{translate("Passed")}: {batchResults.summary.passed}</span>
              <span className="tabular-nums font-semibold text-red-600 dark:text-red-400">{translate("Failed")}: {batchResults.summary.failed}</span>
            </div>
            {batchResults.results.length === 0 ? (
              <p className="py-6 text-center text-sm text-text-muted">{translate("No connections were tested.")}</p>
            ) : (
              <div className="flex max-h-[50vh] flex-col gap-1.5 overflow-y-auto pr-1">
                {batchResults.results.map((r, idx) => (
                  <div
                    key={`${r.connectionId || r.providerLabel}-${idx}`}
                    className="flex min-w-0 items-start gap-2 rounded-lg border border-border bg-background px-3 py-2"
                  >
                    <span className={`material-symbols-outlined shrink-0 text-base ${r.valid ? "text-emerald-500" : "text-red-500"}`}>
                      {r.valid ? "check_circle" : "cancel"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-text-main">
                        {r.providerLabel || r.provider} · {r.connectionName || "—"}
                      </p>
                      {r.valid ? (
                        <p className="text-xs text-text-muted">
                          {translate("Connected")}{r.latencyMs ? ` · ${Math.round(r.latencyMs)}ms` : ""}
                        </p>
                      ) : (
                        <p className="break-words text-xs text-red-500">{r.error || translate("Failed")}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <Button variant="ghost" fullWidth onClick={() => setBatchResults(null)}>
              {translate("Close")}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
