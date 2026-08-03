import React, { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  Radar,
  Shield,
  AlertTriangle,
  Activity,
  Clock,
  RefreshCw,
  Zap,
  CircleDot,
  Eye,
  CheckCircle2,
  Radio,
} from "lucide-react";
import SeverityBadge from "@/components/SeverityBadge";
import StatusBadge from "@/components/StatusBadge";
import CommandProducts from "@/components/CommandProducts";
import PortfolioRelevanceRank from "@/components/PortfolioRelevanceRank";

const sevOrder = ["Critical", "High", "Medium", "Low"];
const sevBar = {
  Critical: "bg-red-500",
  High: "bg-orange-500",
  Medium: "bg-yellow-500",
  Low: "bg-blue-500",
};
const statusMeta = [
  { key: "New", icon: CircleDot, color: "text-blue-400" },
  { key: "Analyzing", icon: Eye, color: "text-amber-400" },
  { key: "Mitigated", icon: CheckCircle2, color: "text-emerald-400" },
];
const sources = [
  "CISA KEV", "NVD", "US-CERT/CISA", "CISA Alerts",
  "Krebs on Security", "Bleeping Computer", "Dark Reading", "SANS ISC",
  "Threatpost", "SecurityWeek", "Recorded Future", "Unit 42",
  "Talos Intelligence", "The Hacker News", "Schneier on Security",
  "Naked Security", "Malwarebytes Labs", "Graham Cluley",
  "The Record", "CyberScoop",
];

function relativeTime(dateStr) {
  if (!dateStr) return "—";
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function KpiCard({ icon: Icon, label, value, sub, color, bg }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${bg} ${color}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className="text-3xl font-bold">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

export default function CommandCenter() {
  const qc = useQueryClient();
  const { data: threats = [], isLoading } = useQuery({
    queryKey: ["threats", "all"],
    queryFn: () => base44.entities.Threat.list("-created_date", 200),
  });
  const [now, setNow] = useState(new Date());
  const [collecting, setCollecting] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const active = threats.filter((t) => t.status !== "Mitigated");
  const criticalActive = threats.filter((t) => t.severity === "Critical" && t.status !== "Mitigated");
  const newToday = threats.filter((t) => {
    const d = new Date(t.created_date);
    return d.toDateString() === new Date().toDateString();
  });
  const actioned = threats.filter((t) => t.first_response_date && t.closed_date);
  const avgResponseMs = actioned.length
    ? actioned.reduce((s, t) => s + (new Date(t.closed_date) - new Date(t.first_response_date)), 0) / actioned.length
    : 0;
  const avgHrs = avgResponseMs ? (avgResponseMs / 3600000).toFixed(1) : "—";

  const sevCounts = sevOrder.map((s) => ({
    name: s,
    count: threats.filter((t) => t.severity === s).length,
  }));
  const total = threats.length;

  const statusCounts = statusMeta.map((s) => ({
    ...s,
    count: threats.filter((t) => t.status === s.key).length,
  }));

  const sourceCounts = sources.map((s) => {
    const key = s.toLowerCase();
    return {
      name: s,
      count: threats.filter((t) => (t.source || "").toLowerCase() === key).length,
      last: threats.find((t) => (t.source || "").toLowerCase() === key)?.created_date,
    };
  });

  const recent = [...threats].slice(0, 10);

  const handleCollect = () => {
    setCollecting(true);
    qc.invalidateQueries({ queryKey: ["threats"] });
    setTimeout(() => setCollecting(false), 1200);
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <div className="flex items-center gap-2">
            <Radar className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Command Center</h1>
            <span className="ml-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> LIVE
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1 font-mono">
            {now.toLocaleString("en-US", { timeZone: "America/Chicago" })} · Central Time
          </p>
        </div>
        <button
          onClick={handleCollect}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${collecting ? "animate-spin" : ""}`} />
          {collecting ? "Collecting…" : "Collect Now"}
        </button>
      </div>

      {/* Products & applicable threats */}
      <CommandProducts threats={threats} />

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard icon={Shield} label="Total Threats" value={total} sub={`${active.length} active`} color="text-primary" bg="bg-primary/10" />
        <KpiCard icon={AlertTriangle} label="Critical Active" value={criticalActive.length} sub="needs triage" color="text-red-500" bg="bg-red-500/10" />
        <KpiCard icon={Zap} label="New Today" value={newToday.length} sub="last 24h" color="text-orange-500" bg="bg-orange-500/10" />
        <KpiCard icon={Clock} label="Avg Response" value={avgHrs} sub="hours to close" color="text-emerald-500" bg="bg-emerald-500/10" />
      </div>

      {/* Active threats ranked by portfolio relevance */}
      <PortfolioRelevanceRank threats={threats} />

      <div className="grid lg:grid-cols-3 gap-6 mb-6">
        {/* Severity distribution */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="font-semibold mb-4">Severity Distribution</h3>
          <div className="space-y-3">
            {sevCounts.map((s) => {
              const pct = total ? (s.count / total) * 100 : 0;
              return (
                <div key={s.name}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium">{s.name}</span>
                    <span className="text-muted-foreground">{s.count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className={`h-full ${sevBar[s.name]} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Status pipeline */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="font-semibold mb-4">Status Pipeline</h3>
          <div className="space-y-4">
            {statusCounts.map((s) => {
              const Icon = s.icon;
              const pct = total ? (s.count / total) * 100 : 0;
              return (
                <div key={s.key} className="flex items-center gap-3">
                  <Icon className={`w-5 h-5 ${s.color}`} />
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{s.key}</span>
                      <span className="text-muted-foreground">{s.count}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden mt-1">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Source status */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Radio className="w-4 h-4 text-primary" /> Source Status
          </h3>
          <div className="space-y-2.5">
            {sourceCounts.map((s) => (
              <div key={s.name} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full ${s.count ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
                  {s.name}
                </span>
                <span className="text-xs text-muted-foreground">
                  {s.count} · {relativeTime(s.last)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Critical watchlist */}
      <div className="rounded-xl border border-border bg-card p-6 mb-6">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-500" /> Critical Watchlist
        </h3>
        {criticalActive.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No active critical threats</p>
        ) : (
          <div className="space-y-1">
            {criticalActive.map((t) => (
              <div key={t.id} className="flex items-center gap-3 py-2.5 border-b border-border last:border-0">
                <SeverityBadge severity={t.severity} />
                <StatusBadge status={t.status} />
                <span className="text-xs text-muted-foreground shrink-0">{t.source || "Unknown"}</span>
                <span className="text-sm truncate flex-1">{t.title}</span>
                {t.cve_id && <span className="text-xs font-mono text-muted-foreground">{t.cve_id}</span>}
                <span className="text-xs text-muted-foreground shrink-0">{relativeTime(t.created_date)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Live activity feed */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" /> Live Activity Feed
          </h3>
          <span className="text-xs text-muted-foreground">Newest first</span>
        </div>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-11 rounded bg-muted animate-pulse" />
            ))}
          </div>
        ) : recent.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No threats recorded yet</p>
        ) : (
          <div className="space-y-1">
            {recent.map((t) => (
              <div key={t.id} className="flex items-center gap-3 py-2.5 border-b border-border last:border-0">
                <SeverityBadge severity={t.severity} />
                <span className="text-xs text-muted-foreground shrink-0">{t.source || "Unknown"}</span>
                <span className="text-sm truncate flex-1">{t.title}</span>
                <StatusBadge status={t.status} />
                <span className="text-xs text-muted-foreground shrink-0">{relativeTime(t.created_date)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}