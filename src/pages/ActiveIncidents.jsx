import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  Activity,
  AlertTriangle,
  Clock,
  Shield,
  PieChart as PieChartIcon,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import SeverityBadge from "@/components/SeverityBadge";
import StatusBadge from "@/components/StatusBadge";

const sevOrder = ["Critical", "High", "Medium", "Low"];
const sevColor = {
  Critical: "#ef4444",
  High: "#f97316",
  Medium: "#eab308",
  Low: "#22c55e",
};

const PIE_COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e"];

function relativeTime(dateStr) {
  if (!dateStr) return "";
  const min = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs} hour${hrs > 1 ? "s" : ""} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days > 1 ? "s" : ""} ago`;
}

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

export default function ActiveIncidents() {
  const { data: threats = [], isLoading } = useQuery({
    queryKey: ["threats", "all"],
    queryFn: () => base44.entities.Threat.list("-created_date", 200),
  });

  const active = useMemo(
    () => threats.filter((t) => t.status !== "Mitigated"),
    [threats]
  );

  const sevCounts = useMemo(() => {
    const map = { Critical: 0, High: 0, Medium: 0, Low: 0 };
    active.forEach((t) => {
      if (map[t.severity] !== undefined) map[t.severity] += 1;
    });
    return map;
  }, [active]);

  const statusCounts = useMemo(() => {
    const map = { New: 0, Analyzing: 0 };
    active.forEach((t) => {
      if (map[t.status] !== undefined) map[t.status] += 1;
    });
    return map;
  }, [active]);

  const pieData = sevOrder.map((s) => ({ name: s, value: sevCounts[s] }));
  const totalActive = active.length;

  const recentActive = useMemo(
    () => [...active].slice(0, 10),
    [active]
  );

  return (
    <div className="p-6 lg:p-8 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Active Incidents</h1>
        <p className="text-sm text-muted-foreground">
          Current threat status and severity breakdown for open incidents
        </p>
      </div>

      {/* Count totals */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={Shield} label="Total Active" value={totalActive} color="text-primary" bg="bg-primary/10" />
        <StatCard icon={Clock} label="New" value={statusCounts.New} color="text-blue-500" bg="bg-blue-500/10" />
        <StatCard icon={Activity} label="Analyzing" value={statusCounts.Analyzing} color="text-orange-500" bg="bg-orange-500/10" />
        <StatCard icon={AlertTriangle} label="Critical Active" value={sevCounts.Critical} color="text-red-500" bg="bg-red-500/10" />
      </div>

      {/* Severity breakdown */}
      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <PieChartIcon className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-semibold">Severity Breakdown</h3>
          </div>
          {isLoading ? (
            <div className="h-64 rounded bg-muted animate-pulse" />
          ) : totalActive === 0 ? (
            <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
              No active incidents
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={2}
                >
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={PIE_COLORS[i]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v) => [v, "incidents"]}
                  contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", fontSize: 12 }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="font-semibold mb-4">By Severity Level</h3>
          <div className="space-y-4">
            {sevOrder.map((s) => {
              const count = sevCounts[s];
              const pct = totalActive ? (count / totalActive) * 100 : 0;
              return (
                <div key={s}>
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <SeverityBadge severity={s} />
                    <span className="text-muted-foreground">
                      {count} <span className="text-xs">({pct.toFixed(0)}%)</span>
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: sevColor[s] }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Active incident list */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Open Incidents</h3>
          <span className="text-xs text-muted-foreground">{recentActive.length} shown</span>
        </div>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 rounded bg-muted animate-pulse" />
            ))}
          </div>
        ) : recentActive.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            No active incidents — all threats mitigated.
          </p>
        ) : (
          <div className="space-y-1">
            {recentActive.map((t) => (
              <div
                key={t.id}
                className="flex items-center gap-3 py-2.5 border-b border-border last:border-0"
              >
                <SeverityBadge severity={t.severity} />
                <StatusBadge status={t.status} />
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