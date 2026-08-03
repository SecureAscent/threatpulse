import React from "react";
import { Link } from "react-router-dom";
import {
  Crosshair,
  AlertTriangle,
  Boxes,
  Loader2,
  ChevronRight,
  Flame,
  Activity,
} from "lucide-react";
import { mapThreatsToProducts, riskTier } from "@/lib/productThreatMap";
import SeverityBadge from "@/components/SeverityBadge";
import StatusBadge from "@/components/StatusBadge";

const TIER_STYLES = {
  critical: {
    card: "border-red-500/40 ring-1 ring-red-500/20",
    header: "bg-red-500/5",
    badge: "bg-red-500 text-white",
    label: "Most At Risk",
  },
  high: {
    card: "border-orange-500/30",
    header: "bg-orange-500/5",
    badge: "bg-orange-500 text-white",
    label: "High Risk",
  },
  moderate: {
    card: "border-border",
    header: "bg-secondary/30",
    badge: "",
    label: "",
  },
};

export default function BlastRadiusMatrix({ threats = [], assets = [], isLoading }) {
  const blast = threats.filter((t) => t.severity === "Critical" || t.severity === "High");
  const products = mapThreatsToProducts(blast, assets);
  const activeBlast = blast.filter((t) => t.status !== "Mitigated").length;
  const criticalRiskCount = products.filter((p) => p.activeCritical > 0).length;

  const stats = [
    { label: "Critical + High Threats", value: blast.length, icon: Crosshair, color: "text-primary", bg: "bg-primary/10" },
    { label: "Active Now", value: activeBlast, icon: Activity, color: "text-orange-500", bg: "bg-orange-500/10" },
    { label: "Most At Risk Products", value: criticalRiskCount, icon: Flame, color: "text-red-500", bg: "bg-red-500/10" },
  ];

  return (
    <>
      <div className="grid grid-cols-3 gap-4 mb-6">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">{s.label}</span>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${s.bg} ${s.color}`}>
                <s.icon className="w-4 h-4" />
              </div>
            </div>
            <p className="text-3xl font-bold mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p>No high-severity threats mapped to products.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {products.map((p) => {
            const tier = riskTier(p);
            const style = TIER_STYLES[tier];
            return (
              <div key={p.name} className={`rounded-xl border bg-card overflow-hidden ${style.card}`}>
                <div className={`flex items-center gap-3 px-5 py-3 border-b border-border ${style.header}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-sm line-clamp-1">{p.name}</h3>
                      {tier !== "moderate" && (
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wide ${style.badge}`}
                        >
                          {tier === "critical" && <Flame className="w-3 h-3" />}
                          {style.label}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                      <span>{p.count} threat{p.count > 1 ? "s" : ""}</span>
                      <span>{p.cves.size} CVE{p.cves.size !== 1 ? "s" : ""}</span>
                      {p.active > 0 && <span className="text-red-500">{p.active} active</span>}
                      <span>Risk score {p.riskScore}</span>
                      {p.asset && (
                        <span className="inline-flex items-center gap-1 text-primary">
                          <span className="font-mono">v{p.asset.current_version || "?"}</span>
                          <span className="text-[10px] uppercase font-semibold">{p.asset.status}</span>
                        </span>
                      )}
                    </div>
                  </div>
                  <SeverityBadge severity={p.topSeverity} />
                  {p.maxCvss > 0 && (
                    <span className="text-xs font-mono text-muted-foreground shrink-0">CVSS {p.maxCvss}</span>
                  )}
                </div>
                <ul className="divide-y divide-border max-h-72 overflow-auto">
                  {p.threats.map((t) => (
                    <li key={t.id}>
                      <Link
                        to={`/threats/${t.id}`}
                        className="flex items-center gap-3 px-5 py-2.5 hover:bg-accent/50 transition-colors"
                      >
                        <SeverityBadge severity={t.severity} />
                        <StatusBadge status={t.status} />
                        <span className="text-sm truncate flex-1">{t.title}</span>
                        {t.cve_id && (
                          <span className="text-xs font-mono text-muted-foreground shrink-0">{t.cve_id}</span>
                        )}
                        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}