import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Search, Loader2, Package, ShieldAlert, User, Boxes } from "lucide-react";
import SeverityBadge from "@/components/SeverityBadge";
import StatusBadge from "@/components/StatusBadge";

const severityOrder = { Critical: 0, High: 1, Medium: 2, Low: 3 };
const sevOptions = ["All", "Critical", "High", "Medium", "Low"];

function matchThreatsToProduct(productName, threats) {
  const name = productName.toLowerCase().trim();
  if (!name) return [];
  return threats.filter((t) => {
    const affected = String(t.affected_products || "").toLowerCase();
    if (!affected) return false;
    const parts = affected.split(/[,;|\n]/).map((s) => s.trim()).filter(Boolean);
    if (parts.length === 0) return affected.includes(name);
    return parts.some((p) => p === name || p.includes(name) || name.includes(p));
  });
}

function MetricCard({ icon: Icon, label, value, color }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-3 mb-2">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      </div>
      <p className="text-2xl font-bold tracking-tight">{value}</p>
    </div>
  );
}

export default function ProductVulnerabilities() {
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState("All");
  const [hideEmpty, setHideEmpty] = useState(false);

  const { data: productsPage, isLoading: productsLoading } = useQuery({
    queryKey: ["product-vuln-products"],
    queryFn: () => base44.entities.Product.filter({}, { sort: "name", limit: 500 }),
  });
  const products = productsPage?.items || [];

  const { data: threatsPage, isLoading: threatsLoading } = useQuery({
    queryKey: ["product-vuln-threats"],
    queryFn: () => base44.entities.Threat.filter({ archived: { $ne: true } }, { sort: "-created_date", limit: 500 }),
  });
  const threats = threatsPage?.items || [];

  const loading = productsLoading || threatsLoading;

  const productThreats = useMemo(() => {
    return products.map((p) => ({
      product: p,
      threats: matchThreatsToProduct(p.name, threats).sort(
        (a, b) => (severityOrder[a.severity] ?? 9) - (severityOrder[b.severity] ?? 9)
      ),
    }));
  }, [products, threats]);

  const filtered = useMemo(() => {
    let result = productThreats;
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(
        ({ product }) =>
          product.name?.toLowerCase().includes(s) ||
          product.vendor?.toLowerCase().includes(s) ||
          product.owner?.toLowerCase().includes(s)
      );
    }
    if (severityFilter !== "All") {
      result = result.filter(({ threats: t }) => t.some((th) => th.severity === severityFilter));
    }
    if (hideEmpty) {
      result = result.filter(({ threats: t }) => t.length > 0);
    }
    return result;
  }, [productThreats, search, severityFilter, hideEmpty]);

  const summary = useMemo(() => {
    const matchedIds = new Set();
    productThreats.forEach(({ threats }) => threats.forEach((t) => matchedIds.add(t.id)));
    return {
      totalProducts: products.length,
      productsWithVulns: productThreats.filter(({ threats }) => threats.length > 0).length,
      totalVulns: matchedIds.size,
      criticalVulns: threats.filter((t) => matchedIds.has(t.id) && t.severity === "Critical").length,
    };
  }, [products, productThreats, threats]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Product Vulnerabilities</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Products, their business owners, and linked vulnerabilities at a glance
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard icon={Boxes} label="Total Products" value={summary.totalProducts} color="bg-blue-500/10 text-blue-500" />
        <MetricCard icon={Package} label="Products with Vulns" value={summary.productsWithVulns} color="bg-orange-500/10 text-orange-500" />
        <MetricCard icon={ShieldAlert} label="Linked Vulnerabilities" value={summary.totalVulns} color="bg-purple-500/10 text-purple-500" />
        <MetricCard icon={ShieldAlert} label="Critical" value={summary.criticalVulns} color="bg-red-500/10 text-red-500" />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 min-w-[14rem] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products, vendors, owners..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {sevOptions.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={hideEmpty}
            onChange={(e) => setHideEmpty(e.target.checked)}
            className="rounded border-input"
          />
          Hide products with no vulnerabilities
        </label>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          No products match the selected filters
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(({ product, threats: productVulns }) => (
            <div key={product.id} className="rounded-xl border border-border bg-card overflow-hidden">
              {/* Product header */}
              <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-border bg-muted/30">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <Package className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-base">{product.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      {product.vendor || "Unassigned vendor"}
                      {product.current_version ? ` · v${product.current_version}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <User className="w-4 h-4" />
                    <span>{product.owner || "Unassigned"}</span>
                  </div>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${
                    product.status === "Active" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" :
                    product.status === "Inactive" ? "bg-amber-500/10 text-amber-500 border-amber-500/20" :
                    "bg-slate-500/10 text-slate-500 border-slate-500/20"
                  }`}>
                    {product.status || "Active"}
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border bg-primary/10 text-primary border-primary/20">
                    {productVulns.length} vuln{productVulns.length !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>

              {/* Vulnerabilities */}
              {productVulns.length === 0 ? (
                <div className="px-5 py-6 text-sm text-muted-foreground text-center">
                  No vulnerabilities detected for this product
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {productVulns.map((t) => (
                    <Link
                      key={t.id}
                      to={`/threats/${t.id}`}
                      className="flex items-center gap-3 px-5 py-3 hover:bg-accent/40 transition-colors group"
                    >
                      <SeverityBadge severity={t.severity} />
                      {t.cve_id && (
                        <span className="font-mono text-xs text-primary whitespace-nowrap">{t.cve_id}</span>
                      )}
                      <span className="flex-1 text-sm font-medium group-hover:text-primary line-clamp-1">
                        {t.title}
                      </span>
                      <StatusBadge status={t.status} />
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {t.created_date ? new Date(t.created_date).toLocaleDateString() : "—"}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}