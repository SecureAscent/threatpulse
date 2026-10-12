import React, { useMemo, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";

const sevOrder = ["Critical", "High", "Medium", "Low"];
const sevColor = {
  Critical: "#ef4444",
  High: "#f97316",
  Medium: "#eab308",
  Low: "#3b82f6",
};

const tooltipStyle = {
  borderRadius: 8,
  border: "1px solid hsl(var(--border))",
  background: "hsl(var(--card))",
  color: "hsl(var(--card-foreground))",
  fontSize: 12,
};

const WINDOWS = [
  { label: "7D", days: 7 },
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
];

export default function ThreatTrendCharts({ threats }) {
  const [windowDays, setWindowDays] = useState(30);

  const data = useMemo(() => {
    const days = windowDays;
    return Array.from({ length: days }).map((_, i) => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - (days - 1 - i));
      const next = new Date(d);
      next.setDate(d.getDate() + 1);
      const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const dayThreats = threats.filter((t) => {
        const td = new Date(t.created_date);
        return td >= d && td < next;
      });
      const row = { day: label, total: dayThreats.length };
      sevOrder.forEach((s) => {
        row[s] = dayThreats.filter((t) => t.severity === s).length;
      });
      return row;
    });
  }, [threats, windowDays]);

  const total = data.reduce((s, d) => s + d.total, 0);
  const critical = data.reduce((s, d) => s + d.Critical, 0);
  const peak = data.reduce((max, d) => (d.total > max.total ? d : max), data[0] || { day: "—", total: 0 });
  const tickInterval = windowDays <= 7 ? 1 : windowDays <= 30 ? 5 : 14;

  return (
    <div className="rounded-xl border border-border bg-card p-6 mb-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="font-semibold">{windowDays}-Day Threat Trends</h3>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>
            <span className="font-semibold text-foreground">{total}</span> threats
          </span>
          <span>
            <span className="font-semibold text-red-500">{critical}</span> critical
          </span>
          <span className="hidden sm:inline">
            Peak: <span className="font-semibold text-foreground">{peak.total}</span> on {peak.day}
          </span>
        </div>
      </div>

      <div className="inline-flex rounded-lg border border-border p-0.5 mb-4 bg-muted/40">
        {WINDOWS.map((w) => (
          <button
            key={w.days}
            onClick={() => setWindowDays(w.days)}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              windowDays === w.days
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {w.label}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Threat volume */}
        <div>
          <p className="text-xs text-muted-foreground mb-2">Daily Volume</p>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={data} margin={{ left: -12, right: 8, top: 4 }}>
              <defs>
                <linearGradient id="volumeGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
              <XAxis dataKey="day" tickLine={false} axisLine={false} className="text-xs" interval={tickInterval} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} className="text-xs" width={28} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area
                type="monotone"
                dataKey="total"
                name="Threats"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="url(#volumeGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Severity breakdown */}
        <div>
          <p className="text-xs text-muted-foreground mb-2">Severity Breakdown</p>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={data} margin={{ left: -12, right: 8, top: 4 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
              <XAxis dataKey="day" tickLine={false} axisLine={false} className="text-xs" interval={tickInterval} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} className="text-xs" width={28} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {sevOrder.map((s) => (
                <Area
                  key={s}
                  type="monotone"
                  dataKey={s}
                  stackId="sev"
                  stroke={sevColor[s]}
                  fill={sevColor[s]}
                  fillOpacity={0.5}
                  strokeWidth={1.5}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}