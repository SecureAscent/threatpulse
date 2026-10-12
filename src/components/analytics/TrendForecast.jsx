import React, { useMemo, useState } from "react";
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { forecastTrend } from "@/lib/riskAnalytics";
import { TrendingUp, TrendingDown, Minus, AlertCircle } from "lucide-react";

const WINDOWS = [
  { label: "7D", days: 7 },
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
];

const tooltipStyle = {
  borderRadius: 8,
  border: "1px solid hsl(var(--border))",
  background: "hsl(var(--card))",
  color: "hsl(var(--card-foreground))",
  fontSize: 12,
};

function ForecastTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={tooltipStyle} className="p-2.5 space-y-0.5">
      <p className="font-semibold text-xs">{label}</p>
      {payload.map((p) => (
        p.value != null && (
          <p key={p.dataKey} className="text-[11px]" style={{ color: p.color }}>
            {p.name}: {p.value}
          </p>
        )
      ))}
    </div>
  );
}

export default function TrendForecast({ threats = [] }) {
  const [windowDays, setWindowDays] = useState(30);

  const { data, stats } = useMemo(() => forecastTrend(threats, windowDays), [threats, windowDays]);
  const tickInterval = windowDays <= 7 ? 1 : windowDays <= 30 ? 5 : 14;

  const trendIcon = stats.slope > 0.15 ? TrendingUp : stats.slope < -0.15 ? TrendingDown : Minus;
  const trendLabel = stats.slope > 0.15 ? "Rising" : stats.slope < -0.15 ? "Declining" : "Stable";
  const trendColor = stats.slope > 0.15 ? "text-red-500" : stats.slope < -0.15 ? "text-emerald-500" : "text-muted-foreground";
  const TrendIcon = trendIcon;

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h3 className="font-semibold">Trend Forecast — {windowDays}D Window</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Daily volume, 7-day moving average, and 7-day projection</p>
        </div>
        <div className="inline-flex rounded-lg border border-border p-0.5 bg-muted/40">
          {WINDOWS.map((w) => (
            <button
              key={w.days}
              onClick={() => setWindowDays(w.days)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                windowDays === w.days ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>

      {/* Forecast stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className="rounded-lg bg-muted/30 p-3">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Avg / Day</p>
          <p className="text-lg font-bold mt-0.5">{stats.mean}</p>
        </div>
        <div className="rounded-lg bg-muted/30 p-3">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Std Dev</p>
          <p className="text-lg font-bold mt-0.5">{stats.stdDev}</p>
        </div>
        <div className="rounded-lg bg-muted/30 p-3">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Anomaly Threshold</p>
          <p className="text-lg font-bold mt-0.5">{stats.threshold}</p>
        </div>
        <div className="rounded-lg bg-muted/30 p-3">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Trend</p>
          <div className={`flex items-center gap-1 mt-0.5 ${trendColor}`}>
            <TrendIcon className="w-4 h-4" />
            <span className="text-lg font-bold">{trendLabel}</span>
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={data} margin={{ left: -12, right: 8, top: 4 }}>
          <defs>
            <linearGradient id="volGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
          <XAxis dataKey="day" tickLine={false} axisLine={false} className="text-xs" interval={tickInterval} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} className="text-xs" width={28} />
          <Tooltip content={<ForecastTooltip />} />
          <ReferenceLine y={stats.threshold} stroke="#ef4444" strokeDasharray="4 4" strokeOpacity={0.3} label={{ value: "anomaly", fill: "#ef4444", fontSize: 9, position: "insideTopRight" }} />
          <Area type="monotone" dataKey="total" name="Volume" stroke="hsl(var(--primary))" strokeWidth={1.5} fill="url(#volGrad)" connectNulls={false} />
          <Line type="monotone" dataKey="movingAvg" name="7-day MA" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} connectNulls />
          <Line type="monotone" dataKey="projected" name="Projected" stroke="#a855f7" strokeWidth={2} strokeDasharray="5 5" dot={false} connectNulls />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 flex-wrap text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-primary rounded" /> Daily Volume
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 rounded" style={{ background: "hsl(var(--chart-2))" }} /> 7-day Moving Avg
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-purple-500 rounded" style={{ borderTop: "2px dashed #a855f7" }} /> 7-day Projection
        </span>
        <span className="flex items-center gap-1.5">
          <AlertCircle className="w-3 h-3 text-red-500" /> Anomaly Threshold
        </span>
      </div>
    </div>
  );
}