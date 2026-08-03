import React, { useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { aggregateControls } from "@/lib/complianceMap";
import { ShieldCheck, Loader2, FileText, Lock } from "lucide-react";

const FW_META = [
  { key: "nist", label: "NIST CSF", icon: ShieldCheck, color: "text-blue-500" },
  { key: "iso", label: "ISO 27001", icon: FileText, color: "text-violet-500" },
  { key: "pci", label: "PCI DSS", icon: Lock, color: "text-amber-500" },
];

function daysBetween(a, b) {
  if (!a || !b) return null;
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}

export default function Compliance() {
  const { data: threats = [], isLoading } = useQuery({
    queryKey: ["threats", "all"],
    queryFn: () => base44.entities.Threat.list("-created_date", 500),
  });

  const total = threats.length;
  const mitigated = threats.filter((t) => t.status === "Mitigated");
  const mitigatedCount = mitigated.length;
  const pct = total ? Math.round((mitigatedCount / total) * 100) : 0;
  const withCloseTime = mitigated.filter((t) => t.first_response_date && t.closed_date);
  const avgClose = withCloseTime.length
    ? Math.round(withCloseTime.reduce((s, t) => s + daysBetween(t.first_response_date, t.closed_date), 0) / withCloseTime.length)
    : null;
  const stale = threats.filter((t) => t.status === "New").length;
  const score = Math.max(0, pct - Math.min(30, Math.round(stale / Math.max(1, total) * 100)));

  const coverage = useMemo(() => aggregateControls(threats), [threats]);

  return (
    <div className="p-6 lg:p-8 max-w-5xl">
      <div className="mb-6 flex items-center gap-2">
        <ShieldCheck className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Compliance</h1>
          <p className="text-sm text-muted-foreground">Remediation posture and SLA adherence</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          <div className="rounded-xl border border-border bg-card p-6 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Compliance Score</h3>
              <span className={`text-3xl font-bold ${score >= 80 ? "text-emerald-500" : score >= 50 ? "text-yellow-500" : "text-red-500"}`}>{score}<span className="text-lg text-muted-foreground">/100</span></span>
            </div>
            <div className="w-full h-2 rounded-full bg-secondary overflow-hidden">
              <div className={`h-full ${score >= 80 ? "bg-emerald-500" : score >= 50 ? "bg-yellow-500" : "bg-red-500"}`} style={{ width: `${score}%` }} />
            </div>
            <p className="text-xs text-muted-foreground mt-2">Derived from mitigation rate and stale open threats.</p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">Total Threats</p>
              <p className="text-2xl font-bold mt-1">{total}</p>
            </div>
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
              <p className="text-xs text-muted-foreground">Mitigated</p>
              <p className="text-2xl font-bold text-emerald-500 mt-1">{mitigatedCount} ({pct}%)</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">Avg Time to Close</p>
              <p className="text-2xl font-bold mt-1">{avgClose !== null ? `${avgClose}d` : "—"}</p>
            </div>
            <div className="rounded-xl border border-orange-500/30 bg-orange-500/5 p-4">
              <p className="text-xs text-muted-foreground">Stale (New)</p>
              <p className="text-2xl font-bold text-orange-500 mt-1">{stale}</p>
            </div>
          </div>

          {/* Framework control coverage */}
          <div className="grid md:grid-cols-3 gap-4 mt-6">
            {FW_META.map((fw) => {
              const Icon = fw.icon;
              const entries = Object.entries(coverage[fw.key] || {}).sort((a, b) => b[1] - a[1]).slice(0, 6);
              return (
                <div key={fw.key} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-center gap-1.5 mb-3">
                    <Icon className={`w-4 h-4 ${fw.color}`} />
                    <h3 className="text-sm font-semibold">{fw.label}</h3>
                    <span className="text-xs text-muted-foreground ml-auto">{entries.length} controls</span>
                  </div>
                  {entries.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No controls mapped yet.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {entries.map(([id, count]) => (
                        <li key={id} className="flex items-center justify-between text-xs">
                          <span className="font-mono font-medium">{id}</span>
                          <span className="text-muted-foreground">{count} threat{count > 1 ? "s" : ""}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}