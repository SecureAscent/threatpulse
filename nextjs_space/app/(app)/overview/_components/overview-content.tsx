'use client';
import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FadeIn, SlideIn } from '@/components/ui/animate';
import {
  Shield, AlertTriangle, Zap, TrendingUp, RefreshCw, ShieldCheck, Crosshair,
  Briefcase, Lightbulb, Target, Package, CalendarClock, UserX, Inbox, Clock,
  Activity, ArrowRight, Gauge,
} from 'lucide-react';
import { statusBadgeClass, statusLabel } from '@/lib/threat-status';
import { riskScore100BadgeClass } from '@/lib/risk-score';

const SeverityChart = dynamic(() => import('../../dashboard/_components/severity-chart'), { ssr: false, loading: () => <div className="h-64 animate-pulse bg-muted rounded-lg" /> });
const TrendChart = dynamic(() => import('../../dashboard/_components/trend-chart'), { ssr: false, loading: () => <div className="h-64 animate-pulse bg-muted rounded-lg" /> });

// ── Severity badge colours ────────────────────────────────────────────────────
const severityBadgeVariant: Record<string, string> = {
  CRITICAL: 'bg-red-500/10 text-red-500 border-red-500/20',
  HIGH: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  MEDIUM: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  LOW: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
};

// ── Types ─────────────────────────────────────────────────────────────────────
interface ActionRequiredItem {
  id: string; threatId?: string | null; title: string; severity: string; status: string;
  dueDate?: string | null; assignedTo?: { id: string; name?: string | null; email: string } | null; overdue?: boolean;
}
interface DashboardData {
  total: number;
  bySeverity: Record<string, number>;
  bySource: Record<string, number>;
  todayCount: number;
  trendData: any[];
  actionRequired?: {
    actionRequiredCount: number; openCount: number; unassignedCount: number; overdueCount: number;
    myAssignedCount: number; myOpenAssignedCount: number; items: ActionRequiredItem[];
  };
  riskInsights?: {
    avgRiskScore: number; kevCount: number; scoredCount: number;
    highRiskThreats: { id: string; threatId?: string | null; title: string; severity: string; status: string; riskScore: number | null; epssPercentile: number | null; isKev: boolean; exploitAvailable: boolean; }[];
  };
}
interface BriefData {
  summary: { totalThreats: number; criticalCount: number; highCount: number; newThisWeek: number; resolvedThisWeek: number; avgRiskScore: number; };
  affectedProducts: { productName: string; department: string; threatCount: number; maxRisk: number }[];
  keyFindings: string[];
  recommendations: string[];
}
interface ComplianceData {
  frameworks: { framework: string; label: string; totalControls: number; coveredControls: number; coveragePercent: number; gaps: any[] }[];
}
interface BlastData {
  stats: { totalThreats: number; totalAffectedAssets: number; totalDepartments: number; mostExposedDepartment: string | null; mostExposedDepartmentCount: number; };
  threats: { id: string; title: string; severity: string; riskScore: number | null; isKev: boolean; assetCount: number }[];
}

// ── Reusable section-header inside cards ─────────────────────────────────────
function SectionHeader({
  icon: Icon, iconClass, title, href, linkLabel = 'View all',
}: { icon: any; iconClass: string; title: string; href?: string; linkLabel?: string }) {
  return (
    <div className="flex items-center justify-between w-full">
      <CardTitle className="text-sm font-semibold flex items-center gap-2.5">
        <div className={`w-6 h-6 rounded-md flex items-center justify-center ${iconClass}`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
        {title}
      </CardTitle>
      {href && (
        <Link href={href} className="flex items-center gap-1 text-xs text-primary hover:text-primary/70 font-medium transition-colors flex-shrink-0">
          {linkLabel} <ArrowRight className="w-3 h-3" />
        </Link>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function OverviewContent() {
  const { data: session } = useSession() || {};
  const user = session?.user as any;
  const role: string = user?.role ?? 'ANALYST';
  const roleLabel = role.replace(/_/g, ' ');
  const execFirst = role === 'VIEWER' || role === 'PARENT_ADMIN';

  const [dash, setDash] = useState<DashboardData | null>(null);
  const [brief, setBrief] = useState<BriefData | null>(null);
  const [compliance, setCompliance] = useState<ComplianceData | null>(null);
  const [blast, setBlast] = useState<BlastData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  const fetchAll = useCallback(async () => {
    const safe = async (url: string) => {
      try { const r = await fetch(url); return r.ok ? await r.json() : null; } catch { return null; }
    };
    const [d, b, c, bl] = await Promise.all([
      safe('/api/dashboard'),
      safe('/api/executive-brief'),
      safe('/api/compliance'),
      safe('/api/blast-radius'),
    ]);
    setDash(d); setBrief(b); setCompliance(c); setBlast(bl);
    setLastFetched(new Date());
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Loading skeleton ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
        <div className="h-[76px] bg-muted animate-pulse rounded-xl" />
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[1,2,3,4,5].map(i => <div key={i} className="h-28 bg-muted animate-pulse rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1,2].map(i => <div key={i} className="h-72 bg-muted animate-pulse rounded-xl" />)}
        </div>
      </div>
    );
  }

  // ── Computed values ─────────────────────────────────────────────────────────
  const bySeverity = dash?.bySeverity ?? {};
  const trendData = dash?.trendData ?? [];
  const total = dash?.total ?? brief?.summary?.totalThreats ?? 0;
  const critical = bySeverity.CRITICAL ?? brief?.summary?.criticalCount ?? 0;
  const high = bySeverity.HIGH ?? brief?.summary?.highCount ?? 0;
  const avgRisk = dash?.riskInsights?.avgRiskScore ?? brief?.summary?.avgRiskScore ?? 0;
  const kev = dash?.riskInsights?.kevCount ?? 0;
  const ar = dash?.actionRequired;
  const ri = dash?.riskInsights;

  // Full static class strings — Tailwind JIT requires no dynamic interpolation
  const heroCards = [
    {
      label: 'Total Threats', value: total,
      icon: Shield, iconColor: 'text-primary', iconBg: 'bg-primary/10',
      borderAccent: 'border-l-4 border-l-primary',
      gradBg: 'bg-gradient-to-br from-primary/5 to-transparent',
    },
    {
      label: 'Critical', value: critical,
      icon: AlertTriangle, iconColor: 'text-red-500', iconBg: 'bg-red-500/10',
      borderAccent: 'border-l-4 border-l-red-500',
      gradBg: 'bg-gradient-to-br from-red-500/5 to-transparent',
    },
    {
      label: 'High Severity', value: high,
      icon: Zap, iconColor: 'text-orange-500', iconBg: 'bg-orange-500/10',
      borderAccent: 'border-l-4 border-l-orange-500',
      gradBg: 'bg-gradient-to-br from-orange-500/5 to-transparent',
    },
    {
      label: 'Avg Risk Score', value: avgRisk ? Number(avgRisk).toFixed(1) : '0.0',
      icon: Gauge, iconColor: 'text-amber-500', iconBg: 'bg-amber-500/10',
      borderAccent: 'border-l-4 border-l-amber-500',
      gradBg: 'bg-gradient-to-br from-amber-500/5 to-transparent',
    },
    {
      label: 'Known Exploited', value: kev,
      icon: Target, iconColor: 'text-red-600', iconBg: 'bg-red-600/10',
      borderAccent: 'border-l-4 border-l-red-600',
      gradBg: 'bg-gradient-to-br from-red-600/5 to-transparent',
    },
  ];

  // Colour-coded action-required sub-tiles
  const arTiles = [
    { label: 'Action Required', value: ar?.actionRequiredCount, icon: AlertTriangle, href: '/threats?filter=action_required', tileCls: 'bg-amber-500/5 border-amber-500/30 hover:border-amber-500/60', iconCls: 'text-amber-500' },
    { label: 'Overdue', value: ar?.overdueCount, icon: CalendarClock, href: '/threats?filter=overdue', tileCls: 'bg-red-500/5 border-red-500/30 hover:border-red-500/60', iconCls: 'text-red-500' },
    { label: 'Unassigned', value: ar?.unassignedCount, icon: UserX, href: '/threats?filter=unassigned', tileCls: 'bg-orange-500/5 border-orange-500/30 hover:border-orange-500/60', iconCls: 'text-orange-500' },
    { label: 'My Open Items', value: ar?.myOpenAssignedCount, icon: Inbox, href: '/threats?filter=mine', tileCls: 'bg-primary/5 border-primary/30 hover:border-primary/60', iconCls: 'text-primary' },
  ];

  // ── Executive block ─────────────────────────────────────────────────────────
  const executiveBlock = (
    <div className="space-y-4">
      {brief && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SlideIn from="left">
            <Card className="border-border/50 border-l-4 border-l-amber-500 h-full">
              <CardHeader className="pb-3">
                <SectionHeader icon={Lightbulb} iconClass="bg-amber-500/10 text-amber-500" title="Key Findings" />
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {(brief.keyFindings ?? []).map((f, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm">
                      <span className="mt-0.5 w-5 h-5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[10px] font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                      <span className="text-muted-foreground leading-relaxed">{f}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </SlideIn>
          <SlideIn from="right">
            <Card className="border-border/50 border-l-4 border-l-emerald-500 h-full">
              <CardHeader className="pb-3">
                <SectionHeader icon={Target} iconClass="bg-emerald-500/10 text-emerald-500" title="Recommendations" />
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {(brief.recommendations ?? []).map((r, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm">
                      <span className="mt-0.5 w-5 h-5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[10px] font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                      <span className="text-muted-foreground leading-relaxed">{r}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </SlideIn>
        </div>
      )}

      {compliance?.frameworks && compliance.frameworks.length > 0 && (
        <SlideIn from="bottom">
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <SectionHeader icon={ShieldCheck} iconClass="bg-emerald-500/10 text-emerald-500" title="Compliance Coverage" href="/compliance" />
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {compliance.frameworks.map((fw) => {
                  const barColor = fw.coveragePercent >= 80 ? 'bg-emerald-500' : fw.coveragePercent >= 50 ? 'bg-amber-500' : 'bg-red-500';
                  const pctColor = fw.coveragePercent >= 80 ? 'text-emerald-500' : fw.coveragePercent >= 50 ? 'text-amber-500' : 'text-red-500';
                  return (
                    <div key={fw.framework} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{fw.label}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{fw.coveredControls}/{fw.totalControls}</span>
                          <span className={`text-xs font-semibold font-mono ${pctColor}`}>{fw.coveragePercent}%</span>
                        </div>
                      </div>
                      <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${fw.coveragePercent}%` }} />
                      </div>
                      {fw.gaps.length > 0 && (
                        <p className="text-[10px] text-muted-foreground">{fw.gaps.length} gap{fw.gaps.length !== 1 ? 's' : ''} identified</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </SlideIn>
      )}

      {blast?.stats && (
        <SlideIn from="left">
          <Card className="border-border/50 border-l-4 border-l-red-500">
            <CardHeader className="pb-3">
              <SectionHeader icon={Crosshair} iconClass="bg-red-500/10 text-red-500" title="Blast Radius Exposure" href="/blast-radius" />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Threats w/ Impact', value: blast.stats.totalThreats },
                  { label: 'Affected Assets', value: blast.stats.totalAffectedAssets },
                  { label: 'Departments', value: blast.stats.totalDepartments },
                ].map(stat => (
                  <div key={stat.label} className="bg-muted/30 rounded-lg p-3.5 border border-border/30 text-center">
                    <p className="text-2xl font-display font-bold tabular-nums">{stat.value}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">{stat.label}</p>
                  </div>
                ))}
              </div>
              {blast.stats.mostExposedDepartment && (
                <div className="flex items-center gap-3 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3">
                  <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                  <span className="text-sm text-muted-foreground">
                    Most exposed: <span className="font-semibold text-foreground">{blast.stats.mostExposedDepartment}</span>
                    <span className="text-red-400 ml-1.5">({blast.stats.mostExposedDepartmentCount} asset{blast.stats.mostExposedDepartmentCount === 1 ? '' : 's'})</span>
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </SlideIn>
      )}
    </div>
  );

  // ── Operational block ───────────────────────────────────────────────────────
  const operationalBlock = (
    <div className="space-y-4">
      {ar && (
        <SlideIn from="bottom">
          <Card className="border-border/50 border-l-4 border-l-amber-500">
            <CardHeader className="pb-3">
              <SectionHeader icon={AlertTriangle} iconClass="bg-amber-500/10 text-amber-500" title="Action Required" href="/threats?filter=action_required" linkLabel="View queue" />
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Coloured KPI tiles */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {arTiles.map(tile => (
                  <Link key={tile.label} href={tile.href} className="block group">
                    <div className={`rounded-lg p-3.5 border ${tile.tileCls} transition-all duration-150`}>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{tile.label}</p>
                        <tile.icon className={`w-3.5 h-3.5 ${tile.iconCls}`} />
                      </div>
                      <p className="text-3xl font-display font-bold tabular-nums">{tile.value ?? 0}</p>
                    </div>
                  </Link>
                ))}
              </div>

              {/* Threat rows */}
              {(ar.items ?? []).length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
                  <Shield className="w-8 h-8 opacity-20" />
                  <p className="text-sm">No action required — all threats are up to date 🎉</p>
                </div>
              ) : (
                <div className="rounded-lg border border-border/50 overflow-hidden">
                  {(ar.items ?? []).map((item, i) => (
                    <Link key={item.id} href={`/threats/${item.id}`} className="block">
                      <div className={`flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors group ${i > 0 ? 'border-t border-border/30' : ''}`}>
                        <Badge className={`text-[10px] font-mono px-2 py-0.5 flex-shrink-0 ${severityBadgeVariant[item.severity] ?? ''}`}>{item.severity ?? 'UNKNOWN'}</Badge>
                        <Badge className={`text-[10px] px-2 py-0.5 flex-shrink-0 ${statusBadgeClass(item.status)}`}>{statusLabel(item.status)}</Badge>
                        <p className="text-sm flex-1 min-w-0 truncate group-hover:text-primary transition-colors">{item.title ?? 'Untitled'}</p>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          {item.assignedTo ? (
                            <span className="text-[11px] text-muted-foreground hidden sm:block truncate max-w-[120px]">{item.assignedTo.name || item.assignedTo.email}</span>
                          ) : (
                            <span className="text-[11px] text-orange-500 font-medium">Unassigned</span>
                          )}
                          {item.dueDate && (
                            <span className={`text-[11px] flex items-center gap-1 ${item.overdue ? 'text-red-500 font-semibold' : 'text-muted-foreground'}`}>
                              <Clock className="w-3 h-3" />
                              {item.overdue ? 'OVERDUE' : new Date(item.dueDate).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </SlideIn>
      )}

      {ri && (
        <SlideIn from="bottom">
          <Card className="border-border/50 border-l-4 border-l-red-500">
            <CardHeader className="pb-3">
              <SectionHeader icon={TrendingUp} iconClass="bg-red-500/10 text-red-500" title="Highest Risk Threats" href="/threats" />
            </CardHeader>
            <CardContent>
              {(ri.highRiskThreats ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No scored threats yet. Run enrichment to populate risk scores.</p>
              ) : (
                <div className="rounded-lg border border-border/50 overflow-hidden">
                  {/* Column headers */}
                  <div className="grid grid-cols-[60px_1fr_auto] gap-3 px-4 py-2 bg-muted/40 border-b border-border/30">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground text-center">Risk</span>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Threat</span>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground text-right">Indicators</span>
                  </div>
                  {(ri.highRiskThreats ?? []).map((item, i) => (
                    <Link key={item.id} href={`/threats/${item.id}`} className="block">
                      <div className={`grid grid-cols-[60px_1fr_auto] gap-3 items-center px-4 py-3 hover:bg-muted/40 transition-colors group ${i > 0 ? 'border-t border-border/30' : ''}`}>
                        <div className={`w-11 mx-auto text-center rounded-md py-1.5 text-sm font-mono font-bold border ${riskScore100BadgeClass(item.riskScore)}`}>
                          {item.riskScore != null ? Math.round(item.riskScore) : '—'}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{item.title}</p>
                          <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{item.threatId}</p>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {item.isKev && (
                            <Badge variant="outline" className="text-[9px] bg-red-500/15 text-red-500 border-red-500/30">KEV</Badge>
                          )}
                          {typeof item.epssPercentile === 'number' && (
                            <span className="text-[10px] text-muted-foreground font-mono hidden md:block">
                              EPSS {Math.round(item.epssPercentile * 100)}%
                            </span>
                          )}
                          <Badge variant="outline" className={`text-[10px] ${statusBadgeClass(item.status)}`}>{statusLabel(item.status)}</Badge>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </SlideIn>
      )}
    </div>
  );

  // ── Analytics (charts) ──────────────────────────────────────────────────────
  const analyticsBlock = (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <SlideIn from="left">
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Severity Distribution</CardTitle>
          </CardHeader>
          <CardContent><div className="h-72"><SeverityChart data={bySeverity} /></div></CardContent>
        </Card>
      </SlideIn>
      <SlideIn from="right">
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">14-Day Threat Trend</CardTitle>
          </CardHeader>
          <CardContent><div className="h-72"><TrendChart data={trendData} /></div></CardContent>
        </Card>
      </SlideIn>
    </div>
  );

  // ── Page render ─────────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">

      {/* ── Header banner ───────────────────────────────────────────────────── */}
      <FadeIn>
        <div className="rounded-xl border border-border/50 bg-gradient-to-r from-primary/5 via-card to-card px-6 py-5 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
              <Activity className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-display font-bold tracking-tight">Command Center</h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Complete security posture — threats, risk, exposure &amp; compliance
                {lastFetched && (
                  <span className="ml-2 opacity-60">· Updated {lastFetched.toLocaleTimeString()}</span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1.5 text-xs font-mono">
              <Briefcase className="w-3 h-3" /> {roleLabel}
            </Badge>
            <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8" disabled={refreshing}
              onClick={() => { setRefreshing(true); fetchAll(); }}>
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
            </Button>
          </div>
        </div>
      </FadeIn>

      {/* ── KPI strip ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {heroCards.map((card, i) => (
          <SlideIn key={card.label} from="bottom" delay={i * 0.05}>
            <Card className={`${card.borderAccent} ${card.gradBg} border-border/50 overflow-hidden`}>
              <CardContent className="pt-5 pb-4 px-5">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground truncate">{card.label}</p>
                    <p className="text-3xl font-display font-bold mt-1.5 tabular-nums">{card.value}</p>
                  </div>
                  <div className={`w-9 h-9 rounded-lg ${card.iconBg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                    <card.icon className={`w-4 h-4 ${card.iconColor}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </SlideIn>
        ))}
      </div>

      {/* ── Top Affected Products ────────────────────────────────────────────── */}
      {brief?.affectedProducts && brief.affectedProducts.length > 0 && (
        <SlideIn from="bottom">
          <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Package className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold">Top Affected Products</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">Products with the highest risk exposure across your portfolio</p>
                  </div>
                </div>
                <Link href="/product-portfolio">
                  <Button size="sm" variant="outline" className="gap-1.5 h-8">
                    View All <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {brief.affectedProducts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No products linked to active threats yet.</p>
                  <p className="text-xs mt-1">Link threats to products in the Product Portfolio.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {brief.affectedProducts.slice(0, 6).map((p, i) => {
                    const stripeClass = p.maxRisk >= 80
                      ? 'bg-gradient-to-r from-red-500 to-red-400'
                      : p.maxRisk >= 60
                        ? 'bg-gradient-to-r from-orange-500 to-orange-400'
                        : p.maxRisk >= 40
                          ? 'bg-gradient-to-r from-amber-500 to-amber-400'
                          : 'bg-gradient-to-r from-emerald-500 to-emerald-400';
                    return (
                      <Link key={i} href="/product-portfolio" className="block group">
                        <div className="relative h-full rounded-lg border border-border/50 bg-card hover:border-primary/40 hover:shadow-md transition-all duration-200 overflow-hidden">
                          <div className={`absolute top-0 left-0 right-0 h-1 ${stripeClass}`} />
                          <div className="p-4 pt-5">
                            <div className="flex items-start justify-between gap-3 mb-3">
                              <div className="min-w-0 flex-1">
                                <h3 className="font-semibold text-sm truncate group-hover:text-primary transition-colors">{p.productName}</h3>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">{p.department || 'Unknown Dept'}</Badge>
                                </div>
                              </div>
                              <div className={`flex-shrink-0 w-14 h-14 rounded-lg flex flex-col items-center justify-center border-2 ${riskScore100BadgeClass(p.maxRisk)}`}>
                                <span className="text-xl font-display font-bold leading-none">{Math.round(p.maxRisk)}</span>
                                <span className="text-[9px] uppercase tracking-wider mt-0.5 opacity-80">Risk</span>
                              </div>
                            </div>
                            <div className="flex items-center justify-between pt-3 border-t border-border/30">
                              <div className="flex items-center gap-1.5 text-muted-foreground">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                <span className="text-xs font-medium">{p.threatCount} Active Threat{p.threatCount === 1 ? '' : 's'}</span>
                              </div>
                              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                            </div>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </SlideIn>
      )}

      {/* ── Role-adaptive content ────────────────────────────────────────────── */}
      {execFirst ? (
        <>{executiveBlock}{analyticsBlock}{operationalBlock}</>
      ) : (
        <>{operationalBlock}{analyticsBlock}{executiveBlock}</>
      )}
    </div>
  );
}
