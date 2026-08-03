import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Package, AlertTriangle, Gauge, Boxes } from "lucide-react";
import SeverityBadge from "@/components/SeverityBadge";
import { matchAsset } from "@/lib/productThreatMap";
import ProductAssetsManager from "@/components/products/ProductAssetsManager";

const sevRank = { Critical: 4, High: 3, Medium: 2, Low: 1 };

export default function ProductPortfolio() {
  const { data: threats = [], isLoading } = useQuery({
    queryKey: ["threats", "all"],
    queryFn: () => base44.entities.Threat.list("-created_date", 200),
  });
  const { data: assets = [] } = useQuery({
    queryKey: ["products", "assets"],
    queryFn: () => base44.entities.Product.list("-created_date", 200),
  });

  const products = useMemo(() => {
    const map = {};
    threats.forEach((t) => {
      const raw = t.affected_products || t.title || "Unknown";
      raw.split(/[,;|]/).map((s) => s.trim()).filter(Boolean).forEach((name) => {
        if (!map[name]) {
          map[name] = { name, count: 0, maxCvss: 0, topSeverity: "Low", active: 0 };
        }
        const p = map[name];
        p.count += 1;
        if ((t.cvss_score || 0) > p.maxCvss) p.maxCvss = t.cvss_score || 0;
        if (sevRank[t.severity] > sevRank[p.topSeverity]) p.topSeverity = t.severity;
        if (t.status !== "Mitigated") p.active += 1;
      });
    });
    const list = Object.values(map).map((p) => ({ ...p, asset: matchAsset(p.name, assets) }));
    return list.sort((a, b) => b.maxCvss - a.maxCvss);
  }, [threats, assets]);

  const highRisk = products.filter((p) => p.maxCvss >= 7).length;
  const avgRisk = products.length
    ? (products.reduce((s, p) => s + p.maxCvss, 0) / products.length).toFixed(1)
    : "0.0";
  const withActive = products.filter((p) => p.active > 0).length;

  const cards = [
    { label: "Products", value: products.length, icon: Boxes, color: "text-primary", bg: "bg-primary/10" },
    { label: "High Risk (≥7)", value: highRisk, icon: AlertTriangle, color: "text-red-500", bg: "bg-red-500/10" },
    { label: "Avg Risk Score", value: avgRisk, icon: Gauge, color: "text-orange-500", bg: "bg-orange-500/10" },
    { label: "Active Threats", value: withActive, icon: Package, color: "text-emerald-500", bg: "bg-emerald-500/10" },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Product Portfolio</h1>
        <p className="text-sm text-muted-foreground">Risk overview across tracked products</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">{c.label}</span>
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${c.bg} ${c.color}`}>
                <c.icon className="w-4.5 h-4.5" />
              </div>
            </div>
            <p className="text-3xl font-bold">{c.value}</p>
          </div>
        ))}
      </div>

      {isLoading ? (
        <div className="rounded-xl border border-border bg-card">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 border-b border-border last:border-0 bg-muted animate-pulse" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Package className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>No products tracked yet.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-xs text-muted-foreground uppercase">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Product</th>
                <th className="text-left px-4 py-3 font-medium">Threats</th>
                <th className="text-left px-4 py-3 font-medium">Top Severity</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Max CVSS</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Active Version</th>
                <th className="text-left px-4 py-3 font-medium">Active</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.name} className="border-t border-border hover:bg-accent/50 transition-colors">
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3">{p.count}</td>
                  <td className="px-4 py-3"><SeverityBadge severity={p.topSeverity} /></td>
                  <td className="px-4 py-3 font-mono text-xs hidden md:table-cell">{p.maxCvss || "—"}</td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    {p.asset ? (
                      <span className="font-mono text-xs">{p.asset.current_version || "—"}</span>
                    ) : (
                      <span className="text-muted-foreground text-xs">untracked</span>
                    )}
                  </td>
                  <td className="px-4 py-3">{p.active > 0 ? <span className="text-red-500 font-medium">{p.active}</span> : <span className="text-muted-foreground">0</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-8">
        <ProductAssetsManager />
      </div>
    </div>
  );
}