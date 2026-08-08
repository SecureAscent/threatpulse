import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { cveProductCorrelation, riskTier } from "@/lib/riskAnalytics";
import { Grid3x3, Search, ChevronRight } from "lucide-react";

const sevColor = {
  Critical: "#ef4444",
  High: "#f97316",
  Medium: "#eab308",
  Low: "#3b82f6",
};

export default function CveProductMatrix({ threats = [] }) {
  const [search, setSearch] = useState("");

  const { cves, products } = useMemo(() => cveProductCorrelation(threats), [threats]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return cves;
    return cves.filter((c) => c.cve_id.toLowerCase().includes(q) || c.products.some((p) => p.toLowerCase().includes(q)));
  }, [cves, search]);

  const displayCves = filtered.slice(0, 25);
  const displayProducts = products.slice(0, 12);

  const multiProduct = cves.filter((c) => c.productCount > 1).length;
  const maxProductCount = Math.max(...cves.map((c) => c.productCount), 1);

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <Grid3x3 className="w-4 h-4 text-primary" />
            CVE → Product Correlation
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {cves.length} CVEs across {products.length} products · <span className="text-red-500 font-medium">{multiProduct}</span> multi-product CVEs (highest blast radius)
          </p>
        </div>
        <div className="relative w-48">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter CVE or product…"
            className="w-full h-8 pl-8 pr-3 rounded-lg border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      {displayCves.length === 0 ? (
        <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">
          No CVE-product correlations found. CVEs with affected product data will appear here.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-2 font-semibold text-muted-foreground sticky left-0 bg-card">CVE</th>
                <th className="text-center py-2 px-2 font-semibold text-muted-foreground">Risk</th>
                <th className="text-center py-2 px-2 font-semibold text-muted-foreground">Threats</th>
                {displayProducts.map((p) => (
                  <th key={p} className="py-2 px-1 font-medium text-muted-foreground text-center max-w-[80px] truncate" title={p}>
                    <span className="block truncate">{p}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayCves.map((cve) => {
                const tier = riskTier(cve.maxScore);
                return (
                  <tr key={cve.cve_id} className="border-b border-border/50 hover:bg-accent/30 transition-colors">
                    <td className="py-2 px-2 sticky left-0 bg-card">
                      <Link
                        to={`/threats?cve=${cve.cve_id}`}
                        className="font-mono text-xs text-primary hover:underline"
                      >
                        {cve.cve_id}
                      </Link>
                    </td>
                    <td className="py-2 px-2 text-center">
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${tier.bg}`}>
                        {cve.maxScore}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-center text-muted-foreground">{cve.threatCount}</td>
                    {displayProducts.map((p) => {
                      const affected = cve.products.includes(p);
                      const intensity = affected ? cve.productCount / maxProductCount : 0;
                      return (
                        <td key={p} className="py-2 px-1 text-center">
                          {affected ? (
                            <span
                              className="inline-flex items-center justify-center w-6 h-6 rounded-md mx-auto text-[9px] font-bold text-white"
                              style={{
                                background: sevColor[cve.maxSeverity] || sevColor.Low,
                                opacity: 0.35 + intensity * 0.65,
                              }}
                              title={`${cve.cve_id} → ${p} (${cve.threatCount} threat${cve.threatCount > 1 ? "s" : ""})`}
                            >
                              {cve.threatCount}
                            </span>
                          ) : (
                            <span className="inline-block w-6 h-6 mx-auto" />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Multi-product CVE list (highest blast radius) */}
      {multiProduct > 0 && (
        <div className="mt-4 pt-4 border-t border-border">
          <p className="text-xs font-semibold text-muted-foreground mb-2">Highest Blast Radius (multi-product CVEs)</p>
          <div className="flex flex-wrap gap-2">
            {cves
              .filter((c) => c.productCount > 1)
              .slice(0, 8)
              .map((cve) => {
                const tier = riskTier(cve.maxScore);
                return (
                  <Link
                    key={cve.cve_id}
                    to={`/threats?cve=${cve.cve_id}`}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono border ${tier.bg} hover:opacity-80 transition-opacity`}
                  >
                    {cve.cve_id}
                    <span className="font-sans font-normal opacity-70">({cve.productCount} products)</span>
                    <ChevronRight className="w-3 h-3" />
                  </Link>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
