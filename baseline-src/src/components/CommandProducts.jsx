import React from "react";
import { Link } from "react-router-dom";
import { Package, ChevronRight } from "lucide-react";
import SeverityBadge from "@/components/SeverityBadge";

const sevOrder = ["Critical", "High", "Medium", "Low"];

function parseProducts(value) {
  if (!value) return [];
  return String(value)
    .split(/[,;\n]/)
    .map((p) => p.trim())
    .filter(Boolean);
}

export default function CommandProducts({ threats }) {
  const productMap = {};
  threats.forEach((t) => {
    parseProducts(t.affected_products).forEach((name) => {
      if (!productMap[name]) productMap[name] = [];
      productMap[name].push(t);
    });
  });

  const products = Object.entries(productMap)
    .map(([name, items]) => {
      const counts = sevOrder.map((s) => items.filter((i) => i.severity === s).length);
      const critical = counts[0];
      return { name, items, counts, critical, total: items.length };
    })
    .sort((a, b) => b.critical - a.critical || b.total - a.total);

  if (products.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 mb-6">
        <h3 className="font-semibold mb-2 flex items-center gap-2">
          <Package className="w-4 h-4 text-primary" /> Product Risk
        </h3>
        <p className="text-sm text-muted-foreground py-4 text-center">
          No product associations yet. Assign <code className="text-xs">affected_products</code> to threats to populate this view.
        </p>
      </div>
    );
  }

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold flex items-center gap-2">
          <Package className="w-4 h-4 text-primary" /> Products & Applicable Threats
        </h3>
        <Link
          to="/product-portfolio"
          className="text-xs text-primary hover:underline flex items-center gap-1"
        >
          Full portfolio <ChevronRight className="w-3 h-3" />
        </Link>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {products.map((p) => (
          <div key={p.name} className="rounded-xl border border-border bg-card p-5 flex flex-col">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-sm font-semibold truncate">{p.name}</span>
              <span className="text-xs text-muted-foreground shrink-0">{p.total} threat{p.total !== 1 ? "s" : ""}</span>
            </div>

            {/* severity mini summary */}
            <div className="flex items-center gap-1.5 mb-3">
              {sevOrder.map((s, i) =>
                p.counts[i] > 0 ? (
                  <span
                    key={s}
                    className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                      s === "Critical"
                        ? "bg-red-500/10 text-red-500"
                        : s === "High"
                        ? "bg-orange-500/10 text-orange-500"
                        : s === "Medium"
                        ? "bg-yellow-500/10 text-yellow-500"
                        : "bg-blue-500/10 text-blue-500"
                    }`}
                  >
                    {p.counts[i]} {s[0]}
                  </span>
                ) : null
              )}
            </div>

            {/* applicable threats */}
            <div className="space-y-1.5 flex-1">
              {p.items.slice(0, 4).map((t) => (
                <div key={t.id} className="flex items-center gap-2 text-xs">
                  <SeverityBadge severity={t.severity} />
                  <span className="truncate flex-1">{t.cve_id || t.title}</span>
                </div>
              ))}
              {p.total > 4 && (
                <p className="text-[11px] text-muted-foreground pl-1">+{p.total - 4} more</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}