'use client';
import { useMemo } from 'react';
import dynamic from 'next/dynamic';
import { compositeRiskScore, riskTier } from '@/lib/risk-analytics';
import type { ThreatLike } from '@/lib/risk-analytics';

const sevColor: Record<string, string> = {
  CRITICAL: '#ef4444',
  HIGH: '#f97316',
  MEDIUM: '#eab308',
  LOW: '#3b82f6',
};

const tooltipStyle = {
  borderRadius: 8,
  border: '1px solid hsl(var(--border))',
  background: 'hsl(var(--card))',
  color: 'hsl(var(--card-foreground))',
  fontSize: 12,
  maxWidth: 280,
};

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const t = payload[0]?.payload;
  if (!t) return null;
  return (
    <div style={tooltipStyle} className="p-3 space-y-1">
      <p className="font-semibold text-xs line-clamp-2">{t.title}</p>
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <span className="font-mono">{t.threatId}</span>
        {t.severity && (
          <span style={{ color: sevColor[(t.severity || '').toUpperCase()] }} className="font-semibold">{t.severity}</span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] pt-1">
        <span className="text-muted-foreground">CVSS:</span>
        <span className="font-mono">{t.cvssScore || '—'}</span>
        <span className="text-muted-foreground">EPSS:</span>
        <span className="font-mono">{t.epssScore ? `${(t.epssScore * 100).toFixed(1)}%` : '—'}</span>
        <span className="text-muted-foreground">Risk Score:</span>
        <span className="font-mono font-semibold">{t.riskScore}</span>
      </div>
    </div>
  );
}

const ResponsiveScatter = dynamic(() => import('./scatter-plot-async'), {
  ssr: false,
  loading: () => <div className="h-[300px] animate-pulse bg-muted rounded-lg" />,
});

export default function RiskScatterPlot({ threats = [] }: { threats?: ThreatLike[] }) {
  const data = useMemo(() => {
    return threats
      .filter((t) => t.cvssScore || t.epssScore)
      .map((t) => ({
        ...t,
        riskScore: compositeRiskScore(t),
        x: t.epssScore || 0,
        y: t.cvssScore || 0,
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
        Top-right quadrant = highest priority (high exploit probability + high impact).
      </p>

      {data.length === 0 ? (
        <div className="h-[300px] flex items-center justify-center text-sm text-muted-foreground">
          No threats with CVSS or EPSS scores yet.
        </div>
      ) : (
        <ResponsiveScatter data={data} avgCvss={avgCvss} avgEpss={avgEpss} sevColor={sevColor} CustomTooltip={CustomTooltip} />
      )}

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
