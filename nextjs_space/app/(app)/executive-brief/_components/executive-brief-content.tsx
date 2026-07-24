'use client';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Briefcase,
  Shield,
  AlertTriangle,
  TrendingUp,
  Clock,
  CheckCircle,
  Download,
  Lightbulb,
  ListChecks,
} from 'lucide-react';
import { FadeIn, SlideIn } from '@/components/ui/animate';

interface BriefData {
  generatedAt: string;
  period: { start: string; end: string };
  summary: {
    totalThreats: number;
    criticalCount: number;
    highCount: number;
    newThisWeek: number;
    resolvedThisWeek: number;
    avgRiskScore: number;
  };
  topThreats: {
    id: string;
    title: string;
    severity: string;
    riskScore: number;
    status: string;
    isKev: boolean;
    affectedAssetCount: number;
  }[];
  riskTrend: { date: string; avgRisk: number; count: number }[];
  affectedProducts: { productName: string; department: string; threatCount: number; maxRisk: number }[];
  complianceSnapshot: { framework: string; coveragePercent: number }[];
  keyFindings: string[];
  recommendations: string[];
}

function sevBadgeClass(sev: string): string {
  switch ((sev || '').toUpperCase()) {
    case 'CRITICAL':
      return 'bg-red-500/15 text-red-500 border-red-500/30';
    case 'HIGH':
      return 'bg-orange-500/15 text-orange-500 border-orange-500/30';
    case 'MEDIUM':
      return 'bg-yellow-500/15 text-yellow-600 border-yellow-500/30';
    case 'LOW':
      return 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
}

function coverageColor(pct: number): string {
  if (pct >= 80) return 'bg-emerald-500';
  if (pct >= 50) return 'bg-yellow-500';
  return 'bg-red-500';
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return iso;
  }
}

function RiskTrendChart({ trend }: { trend: BriefData['riskTrend'] }) {
  const w = 760;
  const h = 200;
  const padL = 36;
  const padR = 14;
  const padT = 16;
  const padB = 26;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const maxRisk = Math.max(10, ...trend.map((d) => d.avgRisk));
  const pts = trend.map((d, i) => {
    const x = padL + (trend.length <= 1 ? 0 : (i / (trend.length - 1)) * innerW);
    const y = padT + innerH - (d.avgRisk / maxRisk) * innerH;
    return { x, y, d };
  });
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const area =
    pts.length > 0
      ? `${line} L${pts[pts.length - 1].x.toFixed(1)},${(padT + innerH).toFixed(1)} L${pts[0].x.toFixed(1)},${(
          padT + innerH
        ).toFixed(1)} Z`
      : '';
  const yTicks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet" className="overflow-visible">
      {yTicks.map((f, i) => {
        const y = padT + innerH - f * innerH;
        const val = Math.round(maxRisk * f * 10) / 10;
        return (
          <g key={i}>
            <line x1={padL} y1={y} x2={w - padR} y2={y} stroke="currentColor" className="text-border" strokeWidth={1} />
            <text x={padL - 6} y={y + 3} textAnchor="end" className="fill-muted-foreground" fontSize={9}>
              {val}
            </text>
          </g>
        );
      })}
      {area && <path d={area} className="fill-primary/10" />}
      {line && <path d={line} fill="none" className="stroke-primary" strokeWidth={2} />}
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={1.8} className="fill-primary" />
      ))}
      {trend.length > 0 && (
        <>
          <text x={padL} y={h - 8} className="fill-muted-foreground" fontSize={9}>
            {trend[0].date.slice(5)}
          </text>
          <text x={w - padR} y={h - 8} textAnchor="end" className="fill-muted-foreground" fontSize={9}>
            {trend[trend.length - 1].date.slice(5)}
          </text>
        </>
      )}
    </svg>
  );
}

export default function ExecutiveBriefContent() {
  const [data, setData] = useState<BriefData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/executive-brief')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load briefing');
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-6">
        <div className="h-64 bg-muted animate-pulse rounded-xl" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 max-w-[1100px] mx-auto">
        <Card className="border-border/50">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {error ?? 'No briefing data available.'}
          </CardContent>
        </Card>
      </div>
    );
  }

  const s = data.summary;
  const cards = [
    { label: 'Total Threats', value: s.totalThreats, icon: Shield, color: 'text-primary' },
    { label: 'Critical', value: s.criticalCount, icon: AlertTriangle, color: 'text-red-500' },
    { label: 'High', value: s.highCount, icon: AlertTriangle, color: 'text-orange-500' },
    { label: 'New This Week', value: s.newThisWeek, icon: TrendingUp, color: 'text-blue-500' },
    { label: 'Resolved (7d)', value: s.resolvedThisWeek, icon: CheckCircle, color: 'text-emerald-500' },
    { label: 'Avg Risk', value: s.avgRiskScore.toFixed(1), icon: Clock, color: 'text-purple-500' },
  ];

  return (
    <div className="p-6 space-y-6 max-w-[1100px] mx-auto">
      <FadeIn>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
              <Briefcase className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold tracking-tight">Executive Brief</h1>
              <p className="text-sm text-muted-foreground">
                {fmtDate(data.period.start)} &ndash; {fmtDate(data.period.end)} &middot; High-level threat posture for
                leadership
              </p>
            </div>
          </div>
          <Button onClick={() => window.open('/api/executive-brief/pdf', '_blank')} className="gap-2">
            <Download className="w-4 h-4" />
            Download PDF
          </Button>
        </div>
      </FadeIn>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {cards.map((card, i) => (
          <SlideIn key={card.label} from="bottom" delay={i * 0.04}>
            <Card className="border-border/50">
              <CardContent className="pt-5 pb-4 px-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{card.label}</p>
                    <p className="text-2xl font-display font-bold mt-1">{card.value}</p>
                  </div>
                  <card.icon className={`w-5 h-5 ${card.color}`} />
                </div>
              </CardContent>
            </Card>
          </SlideIn>
        ))}
      </div>

      <SlideIn from="bottom" delay={0.1}>
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" /> 30-Day Risk Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RiskTrendChart trend={data.riskTrend} />
          </CardContent>
        </Card>
      </SlideIn>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SlideIn from="left" delay={0.12}>
          <Card className="border-border/50 h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-primary" /> Key Findings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {data.keyFindings.map((f, i) => (
                  <li key={i} className="flex gap-2 text-sm">
                    <span className="text-primary mt-0.5">&bull;</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </SlideIn>
        <SlideIn from="right" delay={0.15}>
          <Card className="border-border/50 h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <ListChecks className="w-4 h-4 text-emerald-500" /> Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {data.recommendations.map((r, i) => (
                  <li key={i} className="flex gap-2 text-sm">
                    <span className="text-emerald-500 mt-0.5">&bull;</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </SlideIn>
      </div>

      <SlideIn from="bottom" delay={0.18}>
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Top Threats by Risk</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
                    <th className="text-left font-medium px-4 py-2 w-6"></th>
                    <th className="text-left font-medium px-4 py-2">Threat</th>
                    <th className="text-left font-medium px-4 py-2">Severity</th>
                    <th className="text-right font-medium px-4 py-2">Risk</th>
                    <th className="text-left font-medium px-4 py-2">KEV</th>
                    <th className="text-right font-medium px-4 py-2">Assets</th>
                    <th className="text-left font-medium px-4 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topThreats.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center text-muted-foreground py-6">
                        No threats recorded.
                      </td>
                    </tr>
                  ) : (
                    data.topThreats.map((t, i) => (
                      <tr key={t.id} className="border-b border-border/50 last:border-0">
                        <td className="px-4 py-2 text-muted-foreground">{i + 1}</td>
                        <td className="px-4 py-2 font-medium max-w-[280px] truncate">{t.title}</td>
                        <td className="px-4 py-2">
                          <Badge variant="outline" className={sevBadgeClass(t.severity)}>
                            {t.severity}
                          </Badge>
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">{t.riskScore.toFixed(1)}</td>
                        <td className="px-4 py-2">
                          {t.isKev ? (
                            <Badge variant="outline" className="bg-red-500/15 text-red-500 border-red-500/30">
                              KEV
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">&mdash;</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">{t.affectedAssetCount}</td>
                        <td className="px-4 py-2 text-muted-foreground">{t.status}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </SlideIn>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SlideIn from="left" delay={0.2}>
          <Card className="border-border/50 h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Most Affected Products</CardTitle>
            </CardHeader>
            <CardContent className="px-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
                      <th className="text-left font-medium px-4 py-2">Product</th>
                      <th className="text-left font-medium px-4 py-2">Department</th>
                      <th className="text-right font-medium px-4 py-2">Threats</th>
                      <th className="text-right font-medium px-4 py-2">Max Risk</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.affectedProducts.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="text-center text-muted-foreground py-6">
                          No affected products.
                        </td>
                      </tr>
                    ) : (
                      data.affectedProducts.map((p, i) => (
                        <tr key={i} className="border-b border-border/50 last:border-0">
                          <td className="px-4 py-2 font-medium">{p.productName}</td>
                          <td className="px-4 py-2 text-muted-foreground">{p.department}</td>
                          <td className="px-4 py-2 text-right tabular-nums">{p.threatCount}</td>
                          <td className="px-4 py-2 text-right tabular-nums">{p.maxRisk.toFixed(1)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </SlideIn>

        <SlideIn from="right" delay={0.22}>
          <Card className="border-border/50 h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Compliance Coverage</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-1">
              {data.complianceSnapshot.map((c) => (
                <div key={c.framework}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium">{c.framework}</span>
                    <span className="text-xs text-muted-foreground">{c.coveragePercent}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${coverageColor(c.coveragePercent)}`}
                      style={{ width: `${c.coveragePercent}%` }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </SlideIn>
      </div>
    </div>
  );
}
