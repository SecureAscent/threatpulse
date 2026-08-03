import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Search, X, ExternalLink, Bug } from "lucide-react";
import SeverityBadge from "@/components/SeverityBadge";

export default function CveDatabase() {
  const [query, setQuery] = useState("");
  const [sevFilter, setSevFilter] = useState("All");
  const { data: threats = [], isLoading } = useQuery({
    queryKey: ["threats", "all"],
    queryFn: () => base44.entities.Threat.list("-created_date", 200),
  });

  const cves = useMemo(() => threats.filter((t) => t.cve_id), [threats]);

  const filtered = useMemo(() => {
    return cves.filter((t) => {
      if (sevFilter !== "All" && t.severity !== sevFilter) return false;
      if (query) {
        const q = query.toLowerCase();
        const hay = `${t.cve_id} ${t.title} ${t.affected_products || ""} ${t.source}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [cves, query, sevFilter]);

  const hasFilters = query || sevFilter !== "All";

  return (
    <div className="p-6 lg:p-8 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">CVE Database</h1>
        <p className="text-sm text-muted-foreground">Search and browse Common Vulnerabilities and Exposures</p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 min-w-56">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search CVE-2025-1234, Exchange, Cisco…"
            className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <select
          value={sevFilter}
          onChange={(e) => setSevFilter(e.target.value)}
          className="px-3 py-2.5 rounded-lg border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option>All</option>
          <option>Critical</option>
          <option>High</option>
          <option>Medium</option>
          <option>Low</option>
        </select>
        {hasFilters && (
          <button
            onClick={() => { setQuery(""); setSevFilter("All"); }}
            className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-lg border border-input text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <X className="w-4 h-4" /> Clear
          </button>
        )}
      </div>

      <p className="text-xs text-muted-foreground mb-4">{filtered.length} CVEs</p>

      {isLoading ? (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-14 border-b border-border last:border-0 bg-muted animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Bug className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>No CVEs found{hasFilters ? " for your filters" : ""}.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-xs text-muted-foreground uppercase">
              <tr>
                <th className="text-left px-4 py-3 font-medium">CVE ID</th>
                <th className="text-left px-4 py-3 font-medium">Title</th>
                <th className="text-left px-4 py-3 font-medium">Severity</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">CVSS</th>
                <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Source</th>
                <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Date</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id} className="border-t border-border hover:bg-accent/50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs font-medium whitespace-nowrap"><Link to={`/threats/${t.id}`} className="hover:text-primary hover:underline">{t.cve_id}</Link></td>
                  <td className="px-4 py-3">
                    <p className="font-medium line-clamp-1 max-w-xs">{t.title}</p>
                    {t.affected_products && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1 max-w-xs">{t.affected_products}</p>}
                  </td>
                  <td className="px-4 py-3"><SeverityBadge severity={t.severity} /></td>
                  <td className="px-4 py-3 font-mono text-xs hidden md:table-cell">{t.cvss_score ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground hidden lg:table-cell">{t.source || "—"}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground hidden sm:table-cell whitespace-nowrap">
                    {t.created_date ? new Date(t.created_date).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <a
                      href={t.source_url || `https://www.google.com/search?q=${encodeURIComponent(t.cve_id)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex text-muted-foreground hover:text-primary"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}