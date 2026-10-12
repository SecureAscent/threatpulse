import React, { useMemo } from "react";
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  Cell,
} from "recharts";
import { MapPin, Activity, Loader2 } from "lucide-react";

const SOURCE_COLORS = [
  "hsl(192 91% 36%)",
  "hsl(262 83% 58%)",
  "hsl(173 58% 39%)",
  "hsl(12 76% 61%)",
  "hsl(43 74% 66%)",
  "hsl(280 65% 60%)",
];

const ACTIVE_STATUSES = ["New", "Analyzing"];
const TREND_DAYS = 14;

export default function ThreatOriginTrends({ threats = [], isLoading }) {
  const data = useMemo(() => {
    const list = threats || [];
    const active = list.filter((t) => ACTIVE_STATUSES.includes(t.status));

    // Top sources by active threat count — "where the most active threats come from"
    const activeBySource = active.reduce((acc, t) => {
      const src = t.source || "Unknown";
      acc[src] = (acc[src] || 0) + 1;
      return acc;
    }, {});
    const sourceData = Object.entries(activeBySource)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    // Top sources overall — used for the time-series trend
    const totalBySource = list.reduce((acc, t) => {
      const src = t.source || "Unknown";
      acc[src] = (acc[src] || 0) + 1;
      return acc;
    }, {});
    const topSources = Object.entries(totalBySource)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name]) => name);

    // Daily counts per top source over the trend window
    const days = [];
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    for (let i = TREND_DAYS - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      days.push(d);
    }
    const trendData = days.map((d) => {
      const key = d.toISOString().slice(0, 10);
      const row = { date: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) };
      topSources.forEach((s) => (row[s] = 0));
      return { key, row };
    });
    list.forEach((t) => {
      if (!t.created_date) return;
      const key = new Date(t.created_date).toISOString().slice(0, 10);
      const entry = trendData.find((e) => e.key === key);
      if (!entry) return;
      const src = t.source || "Unknown";
      if (src in entry.row) entry.row[src] += 1;
    });

    return {
      sourceData,
      trendData: trendData.map((e) => e.row),
      topSources,
      activeCount: active.length,
    };
  }, [threats]);

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 flex items-center justify-center h-40">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const { sourceData, trendData, topSources, activeCount } = data;

  return (
    <div className="space-y-6">
      {/* Active threats by source */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-primary" />
            <h3 className="font-semibold">Most Active Threat Origins</h3>
          </div>
          <span className="text-xs text-muted-foreground">{activeCount} active threat{activeCount !== 1 ? "s" : ""}</span>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Where open and in-analysis threats are originating from
        </p>
        {sourceData.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">No active threats right now.</p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={sourceData} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} className="text-xs" />
              <YAxis type="category" dataKey="name" width={110} tickLine={false} axisLine={false} className="text-xs" />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", fontSize: 12 }}
                cursor={{ fill: "hsl(var(--accent) / 0.4)" }}
              />
              <Bar dataKey="count" name="Active threats" radius={[0, 4, 4, 0]}>
                {sourceData.map((_, i) => (
                  <Cell key={i} fill={SOURCE_COLORS[i % SOURCE_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Source trend over time */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-2 mb-1">
          <Activity className="w-4 h-4 text-primary" />
          <h3 className="font-semibold">Threat Origin Trends</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Daily new threats by source over the last {TREND_DAYS} days
        </p>
        {topSources.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">No threat data yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={trendData} margin={{ left: 0, right: 8, top: 8 }}>
              <defs>
                {topSources.map((s, i) => (
                  <linearGradient key={s} id={`grad-${i}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={SOURCE_COLORS[i % SOURCE_COLORS.length]} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={SOURCE_COLORS[i % SOURCE_COLORS.length]} stopOpacity={0.05} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
              <XAxis dataKey="date" tickLine={false} axisLine={false} className="text-xs" minTickGap={20} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} className="text-xs" width={28} />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", fontSize: 12 }}
                cursor={{ stroke: "hsl(var(--border))" }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {topSources.map((s, i) => (
                <Area
                  key={s}
                  type="monotone"
                  dataKey={s}
                  stackId="1"
                  stroke={SOURCE_COLORS[i % SOURCE_COLORS.length]}
                  strokeWidth={2}
                  fill={`url(#grad-${i})`}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}