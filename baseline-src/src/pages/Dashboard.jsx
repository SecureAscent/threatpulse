import React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  Shield,
  AlertTriangle,
  Zap,
  TrendingUp,
  RefreshCw,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import SeverityBadge from "@/components/SeverityBadge";
import ThreatTrendCharts from "@/components/ThreatTrendCharts";
import ThreatOriginTrends from "@/components/ThreatOriginTrends";

const sevOrder = ["Critical", "High", "Medium", "Low"];
const barColor = {
  Critical: "bg-red-500",
  High: "bg-orange-500",
  Medium: "bg-yellow-500",
  Low: "bg-blue-500",
};

function StatCard({ icon: Icon, label, value, color, bg }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-muted-foreground">{label}</span>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${bg} ${color}`}>
          <Icon className="w-4.5 h-4.5" />
        </div>
      </div>
      <p className="text-3xl font-bold">{value}</p>
    </div>
  );
}

function relativeTime(dateStr) {
  if (!dateStr) return "";
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs} hour${hrs > 1 ? "s" : ""} ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days} day${days > 1 ? "s" : ""} ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function Dashboard() {
  const queryClient = useQueryClient();
  const { data: threats = [], isLoading } = useQuery({
    queryKey: ["threats", "all"],
    queryFn: () => base44.entities.Threat.list("-created_date", 200),
  });

  const [collecting, setCollecting] = React.useState(false);
  const handleCollect = () => {
    setCollecting(true);
    queryClient.invalidateQueries({ queryKey: ["threats"] });
    setTimeout(() => setCollecting(false), 1200);
  };

  const total = threats.length;
  const critical = threats.filter((t) => t.severity === "Critical").length;
  const high = threats.filter((t) => t.severity === "High").length;
  const today = threats.filter((t) => {
    const d = new Date(t.created_date);
    return d.toDateString() === new Date().toDateString();
  }).length;

  const sevCounts = sevOrder.map((s) => ({
    name: s,
    count: threats.filter((t) => t.severity === s).length,
  }));

  const sourceMap = threats.reduce((acc, t) => {
    const src = t.source || "Unknown";
    acc[src] = (acc[src] || 0) + 1;
    return acc;
  }, {});
  const sourceData = Object.entries(sourceMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const recent = [...threats].slice(0, 8);

  return (
    <div className="p-6 lg:p-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Threat Dashboard</h1>
          <p className="text-sm text-muted-foreground">Real-time threat intelligence overview</p>
        </div>
        <button
          onClick={handleCollect}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${collecting ? "animate-spin" : ""}`} />
          {collecting ? "Collecting..." : "Collect Now"}
        </button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={Shield} label="Total Threats" value={total} color="text-primary" bg="bg-primary/10" />
        <StatCard icon={AlertTriangle} label="Critical" value={critical} color="text-red-500" bg="bg-red-500/10" />
        <StatCard icon={Zap} label="High Severity" value={high} color="text-orange-500" bg="bg-orange-500/10" />
        <StatCard icon={TrendingUp} label="Today" value={today} color="text-emerald-500" bg="bg-emerald-500/10" />
      </div>

      {/* Charts row */}
      <div className="grid lg:grid-cols-2 gap-6 mb-6">
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
                    <div className={`h-full ${barColor[s.name]} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="font-semibold mb-4">By Source</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={sourceData} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} className="text-xs" />
              <YAxis type="category" dataKey="name" width={90} tickLine={false} axisLine={false} className="text-xs" />
              <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", fontSize: 12 }} />
              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 30-Day Trends */}
      <ThreatTrendCharts threats={threats} />

      {/* Threat origin detail */}
      <ThreatOriginTrends threats={threats} isLoading={isLoading} />

      {/* Latest Threats */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Latest Threats</h3>
          <span className="text-xs text-muted-foreground">Newest first</span>
        </div>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 rounded bg-muted animate-pulse" />
            ))}
          </div>
        ) : recent.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No threats recorded yet</p>
        ) : (
          <div className="space-y-1">
            {recent.map((t) => (
              <div
                key={t.id}
                className="flex items-center gap-3 py-2.5 border-b border-border last:border-0"
              >
                <SeverityBadge severity={t.severity} />
                <span className="text-xs text-muted-foreground shrink-0">{t.source || "Unknown"}</span>
                <span className="text-sm truncate flex-1">{t.title}</span>
                <span className="text-xs text-muted-foreground shrink-0">{relativeTime(t.created_date)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}