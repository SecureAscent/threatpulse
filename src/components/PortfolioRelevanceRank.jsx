import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { Crosshair, Package } from "lucide-react";
import SeverityBadge from "@/components/SeverityBadge";
import StatusBadge from "@/components/StatusBadge";

const sevRank = { Critical: 4, High: 3, Medium: 2, Low: 1 };

function parseProducts(value) {
  if (!value) return [];
  return String(value)
    .split(/[,;\n|]/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function relativeTime(dateStr) {
  if (!dateStr) return "—";
  const min = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function PortfolioRelevanceRank({ threats }) {
  const { ranked, matchedCount, portfolioSize } = useMemo(() => {
    // Tracked product portfolio = distinct products across all threats
    const productSet = new Set();
    threats.forEach((t) => parseProducts(t.affected_products).forEach((p) => productSet.add(p)));
    const portfolio = [...productSet].filter((p) => p.length >= 3);

    const active = threats.filter((t) => t.status !== "Mitigated");

    const scored = active.map((t) => {
      const hay = `${t.title || ""} ${t.affected_products || ""} ${t.cve_id || ""}`.toLowerCase();
      const matched = portfolio.filter((p) => hay.includes(p.toLowerCase()));
      return { threat: t, matched, relevance: matched.length };
    });

    scored.sort(
      (a, b) =>
        b.relevance - a.relevance ||
        (sevRank[b.threat.severity] || 0) - (sevRank[a.threat.severity] || 0) ||
        new Date(b.threat.created_date) - new Date(a.threat.created_date)
    );

    return {
      ranked: scored,
      matchedCount: scored.filter((s) => s.relevance > 0).length,
      portfolioSize: portfolio.length,
    };
  }, [threats]);

  return (
    <div className="rounded-xl border border-border bg-card p-6 mb-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="font-semibold flex items-center gap-2">
          <Crosshair className="w-4 h-4 text-primary" /> Portfolio Relevance Ranking
        </h3>
        <span className="text-xs text-muted-foreground">
          {matchedCount} of {ranked.length} active threats match {portfolioSize} tracked {portfolioSize === 1 ? "product" : "products"}
        </span>
      </div>

      {ranked.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">No active threats to rank.</p>
      ) : (
        <div>
          {ranked.map((s, i) => (
            <Link
              key={s.threat.id}
              to={`/threats/${s.threat.id}`}
              className="flex items-center gap-3 py-2.5 border-b border-border last:border-0 hover:bg-accent/40 -mx-2 px-2 rounded transition-colors"
            >
              <span
                className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                  s.relevance > 0 ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                }`}
              >
                {i + 1}
              </span>
              <SeverityBadge severity={s.threat.severity} />
              <StatusBadge status={s.threat.status} />
              <span className="text-sm truncate flex-1 min-w-0">{s.threat.title}</span>
              {s.threat.cve_id && (
                <span className="hidden sm:inline text-xs font-mono text-muted-foreground shrink-0">{s.threat.cve_id}</span>
              )}
              <div className="hidden lg:flex items-center gap-1 shrink-0 max-w-[35%] overflow-hidden">
                {s.matched.slice(0, 3).map((p) => (
                  <span
                    key={p}
                    className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 truncate"
                  >
                    <Package className="w-2.5 h-2.5 shrink-0" />
                    <span className="truncate">{p}</span>
                  </span>
                ))}
                {s.matched.length > 3 && <span className="text-[11px] text-muted-foreground">+{s.matched.length - 3}</span>}
              </div>
              <span className={`text-xs font-semibold shrink-0 ${s.relevance > 0 ? "text-primary" : "text-muted-foreground"}`}>
                {s.relevance > 0 ? `${s.relevance} match${s.relevance !== 1 ? "es" : ""}` : "no match"}
              </span>
              <span className="hidden sm:inline text-xs text-muted-foreground shrink-0">{relativeTime(s.threat.created_date)}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}