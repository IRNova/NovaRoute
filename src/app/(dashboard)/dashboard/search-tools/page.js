"use client";

import { translate } from "@/i18n/runtime";
import { useEffect, useMemo, useState } from "react";
import Button from "@/shared/components/Button";
import Input from "@/shared/components/Input";
import Select from "@/shared/components/Select";
import Card from "@/shared/components/Card";
import { CardSkeleton } from "@/shared/components/Loading";
import Badge from "@/shared/components/Badge";
import Toggle from "@/shared/components/Toggle";
import SegmentedControl from "@/shared/components/SegmentedControl";

const TABS = [
  { value: "search", label: translate("Search"), icon: "search" },
  { value: "scrape", label: translate("Scrape"), icon: "web_scraper" },
  { value: "compare", label: translate("Compare"), icon: "compare_arrows" },
];

const TIME_RANGE_OPTIONS = [
  { value: "", label: translate("Any time") },
  { value: "day", label: translate("Past 24 hours") },
  { value: "week", label: translate("Past week") },
  { value: "month", label: translate("Past month") },
  { value: "year", label: translate("Past year") },
];

const SEARCH_TYPE_OPTIONS = [
  { value: "web", label: translate("Web") },
  { value: "news", label: translate("News") },
];

function ResultItem({ result, index }) {
  return (
    <Card.Section className="group">
      <div className="flex items-start gap-3">
        <span className="material-symbols-outlined text-text-muted mt-0.5 shrink-0">
          link
        </span>
        <div className="min-w-0 flex-1">
          <a
            href={result.url}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-text-main hover:text-brand-500 transition-colors truncate block"
          >
            {result.title}
          </a>
          <p className="text-xs text-text-muted truncate">{result.url}</p>
          <p className="text-sm text-text-muted mt-1 leading-relaxed">
            {result.snippet}
          </p>
          {result.source && (
            <Badge variant="default" size="sm" className="mt-2">
              {result.source}
            </Badge>
          )}
        </div>
        <span className="text-xs text-text-muted font-mono shrink-0">
          #{index + 1}
        </span>
      </div>
    </Card.Section>
  );
}

function MetricsRow({ latencyMs, cost, provider, totalResults }) {
  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      <Badge variant="info" icon="timer" size="sm">
        {latencyMs} ms
      </Badge>
      <Badge variant="warning" icon="payments" size="sm">
        ${cost.toFixed(4)}
      </Badge>
      {provider && (
        <Badge variant="primary" icon="travel_explore" size="sm">
          {provider}
        </Badge>
      )}
      {totalResults !== undefined && (
        <Badge variant="default" icon="format_list_numbered" size="sm">
          {totalResults} estimated
        </Badge>
      )}
    </div>
  );
}

function SearchResultsCard({ result }) {
  if (!result) return null;
  return (
    <Card
      title="Search results"
      subtitle={`${result.results.length} result${result.results.length === 1 ? "" : "s"} for "${result.query}"`}
      icon="search"
      className="mt-6"
    >
      <MetricsRow
        latencyMs={result.latencyMs}
        cost={result.cost}
        provider={result.provider}
        totalResults={result.totalResults}
      />
      <div className="space-y-3">
        {result.results.map((item, index) => (
          <ResultItem key={index} result={item} index={index} />
        ))}
      </div>
    </Card>
  );
}

function ScrapeResultsCard({ result }) {
  if (!result) return null;
  return (
    <Card title="Scraped content" subtitle={result.url} icon="web_scraper" className="mt-6">
      <MetricsRow latencyMs={result.latencyMs} cost={result.cost} />
      <div className="space-y-4">
        <div className="p-3 rounded-[10px] bg-bg border border-border-subtle">
          <p className="text-sm font-medium text-text-main">{result.title}</p>
        </div>
        <pre className="text-xs font-mono text-text-muted bg-bg border border-border-subtle p-3 rounded-[10px] overflow-x-auto whitespace-pre-wrap">
          <code>{result.content}</code>
        </pre>
        {result.links.length > 0 && (
          <div>
            <p className="text-sm font-medium text-text-main mb-2">Links</p>
            <ul className="space-y-1">
              {result.links.map((link, index) => (
                <li key={index} className="text-sm text-text-muted flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                  <a href={link.href} target="_blank" rel="noreferrer" className="hover:text-brand-500 truncate">
                    {link.text}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
        {result.images.length > 0 && (
          <div>
            <p className="text-sm font-medium text-text-main mb-2">Images</p>
            <div className="flex flex-wrap gap-2">
              {result.images.map((img, index) => (
                <Badge key={index} variant="default" size="sm" icon="image">
                  {img.alt}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

function CompareResultCard({ label, result, error }) {
  return (
    <Card title={label} icon="travel_explore" className="h-full">
      {error ? (
        <Badge variant="error" icon="error" size="sm">
          {error}
        </Badge>
      ) : !result ? (
        <p className="text-sm text-text-muted">Run a comparison to see results.</p>
      ) : (
        <>
          <MetricsRow
            latencyMs={result.latencyMs}
            cost={result.cost}
            provider={result.provider}
            totalResults={result.totalResults}
          />
          <div className="space-y-3">
            {result.results.map((item, index) => (
              <ResultItem key={index} result={item} index={index} />
            ))}
          </div>
        </>
      )}
    </Card>
  );
}

function CodeExport({ activeTab, config, query, url }) {
  const [copied, setCopied] = useState(false);
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "http://localhost:20128";

  const curl = useMemo(() => {
    const commonHeaders = `  -H "Content-Type: application/json"`;
    if (activeTab === "scrape") {
      const payload = JSON.stringify(
        {
          url,
          includeLinks: config.includeLinks,
          includeImages: config.includeImages,
          rawHtml: config.rawHtml,
        },
        null,
        2
      );
      return `curl -X POST ${baseUrl}/api/search/scrape \\\n${commonHeaders} \\\n  -d '${payload}'`;
    }
    if (activeTab === "compare") {
      const left = JSON.stringify(
        {
          query,
          provider: config.provider,
          top_n: Number(config.topN),
          timeout: Number(config.timeout),
          time_range: config.timeRange,
          search_type: config.searchType,
          safe_search: config.safeSearch,
        },
        null,
        2
      );
      const right = JSON.stringify(
        {
          query,
          provider: config.providerB,
          top_n: Number(config.topN),
          timeout: Number(config.timeout),
          time_range: config.timeRange,
          search_type: config.searchType,
          safe_search: config.safeSearch,
        },
        null,
        2
      );
      return `curl -X POST ${baseUrl}/api/search \\\n${commonHeaders} \\\n  -d '${left}'\n\ncurl -X POST ${baseUrl}/api/search \\\n${commonHeaders} \\\n  -d '${right}'`;
    }
    const payload = JSON.stringify(
      {
        query,
        provider: config.provider,
        top_n: Number(config.topN),
        timeout: Number(config.timeout),
        time_range: config.timeRange,
        search_type: config.searchType,
        safe_search: config.safeSearch,
      },
      null,
      2
    );
    return `curl -X POST ${baseUrl}/api/search \\\n${commonHeaders} \\\n  -d '${payload}'`;
  }, [activeTab, baseUrl, config, query, url]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(curl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Ignore clipboard errors
    }
  };

  return (
    <Card
      title={translate("Code export")}
      subtitle={`cURL example for ${activeTab}`}
      icon="code"
      className="mt-6"
      action={
        <Button variant="secondary" size="sm" icon={copied ? "check" : "content_copy"} onClick={handleCopy}>
          {copied ? "Copied" : "Copy"}
        </Button>
      }
    >
      <pre className="text-xs font-mono text-text-muted bg-bg border border-border-subtle p-3 rounded-[10px] overflow-x-auto whitespace-pre">
        <code>{curl}</code>
      </pre>
    </Card>
  );
}

export default function SearchToolsPage() {
  const [activeTab, setActiveTab] = useState("search");
  const [providers, setProviders] = useState([]);
  const [providersLoading, setProvidersLoading] = useState(true);
  const [config, setConfig] = useState({
    provider: "",
    providerB: "",
    topN: 5,
    timeout: 10000,
    timeRange: "",
    searchType: "web",
    safeSearch: false,
    includeLinks: true,
    includeImages: false,
    rawHtml: false,
  });

  const [query, setQuery] = useState("NovaRoute AI gateway");
  const [url, setUrl] = useState("https://novaroute.app");

  const [searchResult, setSearchResult] = useState(null);
  const [scrapeResult, setScrapeResult] = useState(null);
  const [compareResults, setCompareResults] = useState({ left: null, right: null, leftError: null, rightError: null });

  const [loadingSearch, setLoadingSearch] = useState(false);
  const [loadingScrape, setLoadingScrape] = useState(false);
  const [loadingCompare, setLoadingCompare] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    fetch("/api/search/providers")
      .then((res) => res.json())
      .then((data) => {
        if (!mounted) return;
        const list = data.providers || [];
        setProviders(list);
        if (list.length > 0) {
          setConfig((prev) => ({
            ...prev,
            provider: list[0].id,
            providerB: list[1]?.id || list[0].id,
          }));
        }
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err.message || "Failed to load providers");
      })
      .finally(() => {
        if (mounted) setProvidersLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const providerOptions = useMemo(
    () => providers.map((p) => ({ value: p.id, label: p.name })),
    [providers]
  );

  const updateConfig = (key, value) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoadingSearch(true);
    setError(null);
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          provider: config.provider,
          top_n: Number(config.topN),
          timeout: Number(config.timeout),
          time_range: config.timeRange,
          search_type: config.searchType,
          safe_search: config.safeSearch,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Search failed");
      setSearchResult(data);
    } catch (err) {
      setError(err.message || "Search failed");
    } finally {
      setLoadingSearch(false);
    }
  };

  const handleScrape = async () => {
    if (!url.trim()) return;
    setLoadingScrape(true);
    setError(null);
    try {
      const res = await fetch("/api/search/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          includeLinks: config.includeLinks,
          includeImages: config.includeImages,
          rawHtml: config.rawHtml,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Scrape failed");
      setScrapeResult(data);
    } catch (err) {
      setError(err.message || "Scrape failed");
    } finally {
      setLoadingScrape(false);
    }
  };

  const handleCompare = async () => {
    if (!query.trim()) return;
    setLoadingCompare(true);
    setError(null);
    setCompareResults({ left: null, right: null, leftError: null, rightError: null });
    try {
      const [leftRes, rightRes] = await Promise.all([
        fetch("/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query,
            provider: config.provider,
            top_n: Number(config.topN),
            timeout: Number(config.timeout),
            time_range: config.timeRange,
            search_type: config.searchType,
          }),
        }),
        fetch("/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query,
            provider: config.providerB,
            top_n: Number(config.topN),
            timeout: Number(config.timeout),
            time_range: config.timeRange,
            search_type: config.searchType,
          }),
        }),
      ]);
      const [leftData, rightData] = await Promise.all([leftRes.json(), rightRes.json()]);
      setCompareResults({
        left: leftRes.ok ? leftData : null,
        right: rightRes.ok ? rightData : null,
        leftError: leftRes.ok ? null : leftData.error || "Left search failed",
        rightError: rightRes.ok ? null : rightData.error || "Right search failed",
      });
    } catch (err) {
      setError(err.message || "Comparison failed");
    } finally {
      setLoadingCompare(false);
    }
  };

  if (providersLoading) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <CardSkeleton />
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-main">{translate("Search Tools Studio")}</h1>
          <p className="text-sm text-text-muted mt-1">
            Search, scrape, and compare web search providers in one place.
          </p>
        </div>
        <SegmentedControl options={TABS} value={activeTab} onChange={setActiveTab} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6 items-start">
        <Card title={translate("Live config")} icon="tune" className="lg:sticky lg:top-6">
          <div className="space-y-4">
            <Select
              label="Provider"
              placeholder="Choose a provider"
              options={providerOptions}
              value={config.provider}
              onChange={(e) => updateConfig("provider", e.target.value)}
              disabled={providerOptions.length === 0}
            />
            {activeTab === "compare" && (
              <Select
                label="Compare provider"
                placeholder="Choose a provider"
                options={providerOptions}
                value={config.providerB}
                onChange={(e) => updateConfig("providerB", e.target.value)}
                disabled={providerOptions.length === 0}
              />
            )}
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Top N"
                type="number"
                min={1}
                max={20}
                value={config.topN}
                onChange={(e) => updateConfig("topN", e.target.value)}
              />
              <Input
                label="Timeout (ms)"
                type="number"
                min={1000}
                step={500}
                value={config.timeout}
                onChange={(e) => updateConfig("timeout", e.target.value)}
              />
            </div>
            <Select
              label="Time range"
              options={TIME_RANGE_OPTIONS}
              value={config.timeRange}
              onChange={(e) => updateConfig("timeRange", e.target.value)}
            />
            <Select
              label="Search type"
              options={SEARCH_TYPE_OPTIONS}
              value={config.searchType}
              onChange={(e) => updateConfig("searchType", e.target.value)}
            />
            {activeTab !== "scrape" && (
              <Toggle
                checked={config.safeSearch}
                onChange={(value) => updateConfig("safeSearch", value)}
                label="Safe search"
                size="sm"
              />
            )}
            {activeTab === "scrape" && (
              <>
                <Toggle
                  checked={config.includeLinks}
                  onChange={(value) => updateConfig("includeLinks", value)}
                  label="Include links"
                  size="sm"
                />
                <Toggle
                  checked={config.includeImages}
                  onChange={(value) => updateConfig("includeImages", value)}
                  label="Include images"
                  size="sm"
                />
                <Toggle
                  checked={config.rawHtml}
                  onChange={(value) => updateConfig("rawHtml", value)}
                  label="Raw HTML"
                  size="sm"
                />
              </>
            )}
          </div>
        </Card>

        <div>
          {error && (
            <Card.Section className="mb-4 border-danger/40">
              <div className="flex items-center gap-2 text-danger text-sm">
                <span className="material-symbols-outlined text-[18px]">error</span>
                {error}
              </div>
            </Card.Section>
          )}

          {activeTab === "search" && (
            <Card title={translate("Search")} icon="search">
              <div className="flex flex-col sm:flex-row gap-3">
                <Input
                  label="Query"
                  placeholder="Enter a search query"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  icon="search"
                  className="flex-1"
                />
                <div className="flex items-end">
                  <Button
                    onClick={handleSearch}
                    loading={loadingSearch}
                    disabled={!query.trim() || !config.provider}
                    icon="search"
                    className="w-full sm:w-auto"
                  >
                    Search
                  </Button>
                </div>
              </div>
              <SearchResultsCard result={searchResult} />
            </Card>
          )}

          {activeTab === "scrape" && (
            <Card title={translate("Scrape")} icon="web_scraper">
              <div className="flex flex-col sm:flex-row gap-3">
                <Input
                  label="URL"
                  placeholder="https://example.com"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  icon="language"
                  className="flex-1"
                />
                <div className="flex items-end">
                  <Button
                    onClick={handleScrape}
                    loading={loadingScrape}
                    disabled={!url.trim()}
                    icon="download"
                    className="w-full sm:w-auto"
                  >
                    Scrape
                  </Button>
                </div>
              </div>
              <ScrapeResultsCard result={scrapeResult} />
            </Card>
          )}

          {activeTab === "compare" && (
            <Card title={translate("Compare providers")} icon="compare_arrows">
              <div className="flex flex-col sm:flex-row gap-3 mb-6">
                <Input
                  label="Query"
                  placeholder="Enter a search query"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  icon="search"
                  className="flex-1"
                />
                <div className="flex items-end">
                  <Button
                    onClick={handleCompare}
                    loading={loadingCompare}
                    disabled={!query.trim() || !config.provider || !config.providerB}
                    icon="compare_arrows"
                    className="w-full sm:w-auto"
                  >
                    Compare
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <CompareResultCard
                  label={providerOptions.find((p) => p.value === config.provider)?.label || config.provider}
                  result={compareResults.left}
                  error={compareResults.leftError}
                />
                <CompareResultCard
                  label={providerOptions.find((p) => p.value === config.providerB)?.label || config.providerB}
                  result={compareResults.right}
                  error={compareResults.rightError}
                />
              </div>
            </Card>
          )}

          <CodeExport activeTab={activeTab} config={config} query={query} url={url} />
        </div>
      </div>
    </div>
  );
}
