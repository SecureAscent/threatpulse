import React, { useMemo } from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
  ReferenceArea,
} from "recharts";
import { compositeRiskScore, riskTier } from "@/lib/riskAnalytics";

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
  maxWidth: 280,
};

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const t = payload[0]?.payload;
  if (!t) return null;
  return (
    <div style={tooltipStyle} className="p-3 space-y-1">
      <p className="font-semibold text-xs line-clamp-2">{t.title}</p>
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <span className="font-mono">{t.cve_id}</span>
        {t.severity && (
          <span style={{ color: sevColor[t.severity] }} className="font-semibold">{t.severity}</span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] pt-1">
        <span className="text-muted-foreground">CVSS:</span>
        <span className="font-mono">{t.cvss_score || "—"}</span>
        <span className="text-muted-foreground">EPSS:</span>
        <span className="font-mono">{t.epss_score ? `${(t.epss_score * 100).toFixed(1)}%` : "—"}</span>
        <span className="text-muted-foreground">Risk Score:</span>
        <span className="font-mono font-semibold">{t.riskScore}</span>
        <span className="text-muted-foreground">Status:</span>
        <span>{t.status}</span>
      </div>
    </div>
  );
}

export default function RiskScatterPlot({ threats = [] }) {
  const data = useMemo(() => {
    return threats
      .filter((t) => t.cvss_score || t.epss_score)
      .map((t) => ({
        ...t,
        riskScore: compositeRiskScore(t),
        x: t.epss_score || 0,
        y: t.cvss_score || 0,
      }))
      .sort((a, b) => b.riskScore - a.riskScore);
  }, [threats]);

  const highRisk = data.filter((d) => d.riskScore >= 55).length;
  const avgCvss = data.length ? data.reduce((s, d) => s + d.y, 0) / data.length : 0;
  const avgEpss = data.length ? data.reduce((s, d) => s + d.x, 0) / data.length : 0;

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
        <h3 className="font-semibold">Risk Scatter — EPSS × CVSS</h3>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span><span className="font-semibold text-foreground">{data.length}</span> scored</span>
          <span><span className="font-semibold text-red-500">{highRisk}</span> high-risk</span>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Top-right quadrant = highest priority (high exploit probability + high impact). Bubble color = severity.
      </p>

      {data.length === 0 ? (
        <div className="h-[300px] flex items-center justify-center text-sm text-muted-foreground">
          No threats with CVSS or EPSS scores yet.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <ScatterChart margin={{ left: 0, right: 16, top: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              type="number"
              dataKey="x"
              name="EPSS"
              domain={[0, 1]}
              tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
              tickLine={false}
              axisLine={false}
              className="text-xs"
              label={{ value: "EPSS (exploit probability)", position: "insideBottom", offset: -2, className: "text-[10px] fill-muted-foreground" }}
            />
            <YAxis
              type="number"
              dataKey="y"
              name="CVSS"
              domain={[0, 10]}
              tickLine={false}
              axisLine={false}
              className="text-xs"
              width={32}
              label={{ value: "CVSS", angle: -90, position: "insideLeft", className: "text-[10px] fill-muted-foreground" }}
            />
            <ZAxis range={[60, 160]} />
            <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: "3 3" }} />
            <ReferenceArea x1={avgEpss} x2={1} y1={avgCvss} y2={10} fill="#ef4444" fillOpacity={0.05} />
            <ReferenceLine x={avgEpss} stroke="hsl(var(--muted-foreground))" strokeDasharray="5 5" strokeOpacity={0.4} />
            <ReferenceLine y={avgCvss} stroke="hsl(var(--muted-foreground))" strokeDasharray="5 5" strokeOpacity={0.4} />
            <Scatter data={data}>
              {data.map((entry, i) => (
                <Cell key={i} fill={sevColor[entry.severity] || sevColor.Low} fillOpacity={0.65} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 flex-wrap">
        {Object.entries(sevColor).map(([sev, color]) => (
          <div key={sev} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: color, opacity: 0.7 }} />
            {sev}
          </div>
        ))}
      </div>
    </div>
  );
}
