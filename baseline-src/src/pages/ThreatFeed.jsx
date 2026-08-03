import React, { useState, useMemo, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Search, X, Loader2, FileSpreadsheet } from "lucide-react";
import SeverityBadge from "@/components/SeverityBadge";
import StatusBadge from "@/components/StatusBadge";
import WatchlistChips from "@/components/threats/WatchlistChips";
import { buildThreatListCSV, downloadCsv } from "@/lib/csvExport";
import { useToast } from "@/components/ui/use-toast";

const typeOptions = ["All Types", "Vulnerability", "Ransomware", "Campaign", "Malware", "Breach", "Advisory", "Other"];
const sevOptions = ["All", "High+", "Critical", "High", "Medium", "Low"];
const STORAGE_KEY = "threatfeed:filters";

// Quick-view presets. apply() returns the filter state for that view.
const views = [
  { key: "all", label: "All Threats", apply: () => ({ sevFilter: "All", recentDays: null, productFilter: "", typeFilter: "All Types" }) },
  { key: "high", label: "High Severity", apply: () => ({ sevFilter: "High+", recentDays: null, productFilter: "", typeFilter: "All Types" }) },
  { key: "critical", label: "Critical", apply: () => ({ sevFilter: "Critical", recentDays: null, productFilter: "", typeFilter: "All Types" }) },
  { key: "recent7", label: "Recent (7d)", apply: () => ({ sevFilter: "All", recentDays: 7, productFilter: "", typeFilter: "All Types" }) },
  { key: "recent24", label: "Recent (24h)", apply: () => ({ sevFilter: "All", recentDays: 1, productFilter: "", typeFilter: "All Types" }) },
];

function relativeTime(dateStr) {
  if (!dateStr) return "";
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs} hour${hrs > 1 ? "s" : ""} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days > 1 ? "s" : ""} ago`;
}

export default function ThreatFeed() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [saved] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    } catch {
      return null;
    }
  });
  const [query, setQuery] = useState(saved?.query || "");
  const [typeFilter, setTypeFilter] = useState(saved?.typeFilter || "All Types");
  const [sevFilter, setSevFilter] = useState(saved?.sevFilter || "All");
  const [recentDays, setRecentDays] = useState(saved?.recentDays ?? null);
  const [productFilter, setProductFilter] = useState(saved?.productFilter || "");
  const [selected, setSelected] = useState(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  const { data: threats = [], isLoading } = useQuery({
    queryKey: ["threats", "all"],
    queryFn: () => base44.entities.Threat.list("-created_date", 200),
  });

  // Persist the active filter view
  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ query, typeFilter, sevFilter, recentDays, productFilter })
    );
  }, [query, typeFilter, sevFilter, recentDays, productFilter]);

  // Tracked products derived from threat affected_products
  const products = useMemo(() => {
    const map = {};
    threats.forEach((t) => {
      String(t.affected_products || "")
        .split(/[,;|\n]/)
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((name) => {
          map[name] = (map[name] || 0) + 1;
        });
    });
    return Object.entries(map)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
  }, [threats]);

  // Which quick view is currently active
  const currentView = useMemo(() => {
    for (const v of views) {
      const a = v.apply();
      if (
        a.sevFilter === sevFilter &&
        a.recentDays === recentDays &&
        a.productFilter === productFilter &&
        a.typeFilter === typeFilter
      ) {
        return v.key;
      }
    }
    if (productFilter) return `product:${productFilter}`;
    return "custom";
  }, [sevFilter, recentDays, productFilter, typeFilter]);

  const applyFilters = (partial) => {
    setSevFilter(partial.sevFilter ?? "All");
    setRecentDays(partial.recentDays ?? null);
    setProductFilter(partial.productFilter ?? "");
    setTypeFilter(partial.typeFilter ?? "All Types");
  };
  const applyView = (v) => applyFilters(v.apply());
  const applyProduct = (name) =>
    applyFilters({ sevFilter: "All", recentDays: null, productFilter: name, typeFilter: "All Types" });

  const clearAll = () => {
    setQuery("");
    setSevFilter("All");
    setTypeFilter("All Types");
    setRecentDays(null);
    setProductFilter("");
  };

  const toggle = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = () => {
    if (filtered.length > 0 && selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((t) => t.id)));
    }
  };

  const applyBulkStatus = async (status) => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    setBulkLoading(true);
    try {
      await base44.entities.Threat.bulkUpdate(ids.map((id) => ({ id, status })));
      await qc.invalidateQueries({ queryKey: ["threats"] });
      toast({ title: `Updated ${ids.length} threat${ids.length > 1 ? "s" : ""} to ${status}` });
      setSelected(new Set());
    } catch (e) {
      toast({ title: "Bulk update failed", description: e.message, variant: "destructive" });
    } finally {
      setBulkLoading(false);
    }
  };

  const filtered = useMemo(() => {
    const cutoff = recentDays ? Date.now() - recentDays * 86400000 : null;
    return threats.filter((t) => {
      if (typeFilter !== "All Types" && t.type !== typeFilter) return false;
      if (sevFilter !== "All") {
        if (sevFilter === "High+") {
          if (t.severity !== "Critical" && t.severity !== "High") return false;
        } else if (t.severity !== sevFilter) return false;
      }
      if (cutoff && new Date(t.created_date).getTime() < cutoff) return false;
      if (productFilter) {
        const hay = `${t.affected_products || ""} ${t.title || ""}`.toLowerCase();
        if (!hay.includes(productFilter.toLowerCase())) return false;
      }
      if (query) {
        const q = query.toLowerCase();
        const hay = `${t.title} ${t.description} ${t.cve_id || ""} ${t.source}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [threats, query, typeFilter, sevFilter, recentDays, productFilter]);

  const hasFilters =
    query || typeFilter !== "All Types" || sevFilter !== "All" || recentDays || productFilter;

  const exportList = () => {
    const csv = buildThreatListCSV(filtered);
    downloadCsv(`threatpulse-threats-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  };

  return (
    <div className="p-6 lg:p-8 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Threat Feed</h1>
        <p className="text-sm text-muted-foreground">
          Live intelligence feed from all sources — click any card to open the investigation workflow
        </p>
      </div>

      {/* Quick Views */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mr-1">
          Quick Views
        </span>
        {views.map((v) => (
          <button
            key={v.key}
            onClick={() => applyView(v)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              currentView === v.key
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-foreground/80 border-border hover:border-primary/40 hover:bg-accent"
            }`}
          >
            {v.label}
          </button>
        ))}
        {products.slice(0, 6).map((p) => (
          <button
            key={p.name}
            onClick={() => applyProduct(p.name)}
            title={p.name}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors truncate max-w-[12rem] ${
              currentView === `product:${p.name}`
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-foreground/80 border-border hover:border-primary/40 hover:bg-accent"
            }`}
          >
            {p.name}
          </button>
        ))}
      </div>

      {/* Saved searches / watchlists */}
      <div className="mb-4">
        <WatchlistChips
          current={{ query, typeFilter, sevFilter, recentDays, productFilter }}
          applyFilters={applyFilters}
        />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 min-w-56">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title, CVE, source…"
            className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2.5 rounded-lg border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {typeOptions.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
        <select
          value={sevFilter}
          onChange={(e) => setSevFilter(e.target.value)}
          className="px-3 py-2.5 rounded-lg border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {sevOptions.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
        <select
          value={recentDays == null ? "all" : String(recentDays)}
          onChange={(e) => setRecentDays(e.target.value === "all" ? null : Number(e.target.value))}
          className="px-3 py-2.5 rounded-lg border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">All time</option>
          <option value="1">24 hours</option>
          <option value="7">7 days</option>
        </select>
        <select
          value={productFilter}
          onChange={(e) => setProductFilter(e.target.value)}
          className="px-3 py-2.5 rounded-lg border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring max-w-[12rem]"
        >
          <option value="">All products</option>
          {products.map((p) => (
            <option key={p.name} value={p.name}>
              {p.name}
            </option>
          ))}
        </select>
        {hasFilters && (
          <button
            onClick={clearAll}
            className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-lg border border-input text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <X className="w-4 h-4" /> Clear
          </button>
        )}
      </div>

      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-muted-foreground">{filtered.length} threats</p>
        <div className="flex items-center gap-3">
          <button
            onClick={exportList}
            disabled={filtered.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-input text-xs font-medium hover:bg-accent disabled:opacity-50 transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" /> Export CSV
          </button>
          {filtered.length > 0 && (
            <label className="inline-flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                checked={selected.size === filtered.length}
                onChange={toggleAll}
                className="w-4 h-4 accent-primary"
              />
              Select all
            </label>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-40 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p>No threats found{hasFilters ? " for your filters" : ""}.</p>
        </div>
      ) : (
        <>
          {selected.size > 0 && (
            <div className="sticky top-0 z-20 -mx-6 lg:-mx-8 mb-4 px-6 lg:px-8 py-3 bg-card/95 backdrop-blur border-b border-border flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium">{selected.size} selected</span>
              <span className="text-xs text-muted-foreground">Set status:</span>
              {["New", "Analyzing", "Mitigated"].map((s) => (
                <button
                  key={s}
                  disabled={bulkLoading}
                  onClick={() => applyBulkStatus(s)}
                  className="px-3 py-1.5 rounded-lg border border-input text-xs font-medium hover:bg-accent disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
              <button
                onClick={() => setSelected(new Set())}
                disabled={bulkLoading}
                className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-50"
              >
                <X className="w-3.5 h-3.5" /> Clear
              </button>
            </div>
          )}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((t) => (
              <div
                key={t.id}
                className="relative rounded-xl border border-border bg-card hover:shadow-md hover:border-primary/40 transition-all"
              >
                <input
                  type="checkbox"
                  checked={selected.has(t.id)}
                  onChange={() => toggle(t.id)}
                  onClick={(e) => e.stopPropagation()}
                  className="absolute top-3 left-3 z-10 w-4 h-4 accent-primary cursor-pointer"
                />
                <Link to={`/threats/${t.id}`} className="block p-5 pl-10">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <SeverityBadge severity={t.severity} />
                    <StatusBadge status={t.status} />
                  </div>
                  <span className="text-xs text-muted-foreground uppercase tracking-wide">
                    {t.source || "Unknown"}
                  </span>
                  <h3 className="mt-1.5 text-sm font-semibold text-foreground leading-snug line-clamp-3">
                    {t.title}
                  </h3>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{relativeTime(t.created_date)}</span>
                    <span className="text-xs font-medium text-primary">Investigate →</span>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Source legend */}
      <div className="mt-8 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="font-medium">Sources:</span>
        {[
          "CISA KEV",
          "NVD",
          "H-ISAC",
          "Dark Reading",
          "Krebs",
          "Bleeping Computer",
          "The Hacker News",
          "SecurityWeek",
        ].map((s) => (
          <span key={s} className="px-2 py-0.5 rounded-md border border-border">
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}