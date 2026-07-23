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

const severityBadgeVariant: Record<string, string> = {
  CRITICAL: 'bg-red-500/10 text-red-500 border-red-500/20',
  HIGH: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  MEDIUM: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  LOW: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
};

// ---- Types (loosely matched to the four source APIs) ----
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

export default function OverviewContent() {
  const { data: session } = useSession() || {};
  const user = session?.user as any;
  const role: string = user?.role ?? 'ANALYST';
  const roleLabel = role.replace(/_/g, ' ');
  // Executives / viewers get the business-outcome view first; analysts & admins get the operational view first.
  const execFirst = role === 'VIEWER' || role === 'PARENT_ADMIN';

  const [dash, setDash] = useState<DashboardData | null>(null);
  const [brief, setBrief] = useState<BriefData | null>(null);
  const [compliance, setCompliance] = useState<ComplianceData | null>(null);
  const [blast, setBlast] = useState<BlastData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  if (loading) {
    return (
      <div className="p-6 space-y-6 max-w-[1200px] mx-auto">
        <div className="h-8 w-64 bg-muted animate-pulse rounded" />
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[1,2,3,4,5].map(i => <div key={i} className="h-28 bg-muted animate-pulse rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1,2].map(i => <div key={i} className="h-72 bg-muted animate-pulse rounded-xl" />)}
        </div>
      </div>
    );
  }

  const bySeverity = dash?.bySeverity ?? {};
  const trendData = dash?.trendData ?? [];
  const total = dash?.total ?? brief?.summary?.totalThreats ?? 0;
  const critical = bySeverity.CRITICAL ?? brief?.summary?.criticalCount ?? 0;
  const high = bySeverity.HIGH ?? brief?.summary?.highCount ?? 0;
  const avgRisk = dash?.riskInsights?.avgRiskScore ?? brief?.summary?.avgRiskScore ?? 0;
  const kev = dash?.riskInsights?.kevCount ?? 0;

  const heroCards = [
    { label: 'Total Threats', value: total, icon: Shield, color: 'text-primary', bg: 'bg-primary/10' },
    { label: 'Critical', value: critical, icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-500/10' },
    { label: 'High', value: high, icon: Zap, color: 'text-orange-500', bg: 'bg-orange-500/10' },
    { label: 'Avg Risk', value: avgRisk, icon: Gauge, color: 'text-amber-500', bg: 'bg-amber-500/10' },
    { label: 'Known Exploited', value: kev, icon: Target, color: 'text-red-500', bg: 'bg-red-500/10' },
  ];

  const ar = dash?.actionRequired;
  const ri = dash?.riskInsights;

  // ---------- Executive / business-outcome block ----------
  const executiveBlock = (
    <div className="space-y-6">
      {/* Key findings + recommendations */}
      {brief && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SlideIn from="left">
            <Card className="border-border/50 h-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-amber-500" /> Key Findings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2.5">
                  {(brief.keyFindings ?? []).map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                      <span className="text-muted-foreground">{f}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </SlideIn>
          <SlideIn from="right">
            <Card className="border-border/50 h-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Target className="w-4 h-4 text-emerald-500" /> Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2.5">
                  {(brief.recommendations ?? []).map((r, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                      <span className="text-muted-foreground">{r}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </SlideIn>
        </div>
      )}

      {/* Compliance coverage */}
      {compliance?.frameworks && compliance.frameworks.length > 0 && (
        <SlideIn from="bottom">
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" /> Compliance Coverage
                </CardTitle>
                <Link href="/compliance" className="text-xs text-primary hover:underline flex items-center gap-1">View <ArrowRight className="w-3 h-3" /></Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                {compliance.frameworks.map((fw) => (
                  <div key={fw.framework}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium">{fw.label}</span>
                      <span className="text-xs text-muted-foreground font-mono">{fw.coveredControls}/{fw.totalControls} · {fw.coveragePercent}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full ${fw.coveragePercent >= 80 ? 'bg-emerald-500' : fw.coveragePercent >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                        style={{ width: `${fw.coveragePercent}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </SlideIn>
      )}

      {/* Blast radius exposure */}
      {blast?.stats && (
        <SlideIn from="left">
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Crosshair className="w-4 h-4 text-red-500" /> Blast Radius Exposure
                </CardTitle>
                <Link href="/blast-radius" className="text-xs text-primary hover:underline flex items-center gap-1">View <ArrowRight className="w-3 h-3" /></Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-muted/30 rounded-lg p-3 border border-border/30">
                  <p className="text-xs text-muted-foreground">Threats w/ Impact</p>
                  <p className="text-2xl font-display font-bold mt-1">{blast.stats.totalThreats}</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-3 border border-border/30">
                  <p className="text-xs text-muted-foreground">Affected Assets</p>
                  <p className="text-2xl font-display font-bold mt-1">{blast.stats.totalAffectedAssets}</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-3 border border-border/30">
                  <p className="text-xs text-muted-foreground">Departments</p>
                  <p className="text-2xl font-display font-bold mt-1">{blast.stats.totalDepartments}</p>
                </div>
              </div>
              {blast.stats.mostExposedDepartment && (
                <div className="flex items-center gap-2 text-sm rounded-lg border border-red-500/20 bg-red-500/5 p-3">
                  <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                  <span className="text-muted-foreground">
                    Most exposed: <span className="font-medium text-foreground">{blast.stats.mostExposedDepartment}</span> ({blast.stats.mostExposedDepartmentCount} affected asset{blast.stats.mostExposedDepartmentCount === 1 ? '' : 's'})
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </SlideIn>
      )}
    </div>
  );

  // ---------- Operational block (analyst / admin) ----------
  const operationalBlock = (
    <div className="space-y-6">
      {/* Action Required */}
      {ar && (
        <SlideIn from="bottom">
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" /> Action Required
                </CardTitle>
                <Link href="/threats?filter=action_required" className="text-xs text-primary hover:underline flex items-center gap-1">View queue <ArrowRight className="w-3 h-3" /></Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'Action Required', value: ar.actionRequiredCount, icon: AlertTriangle, color: 'text-amber-500', href: '/threats?filter=action_required' },
                  { label: 'Overdue', value: ar.overdueCount, icon: CalendarClock, color: 'text-red-500', href: '/threats?filter=overdue' },
                  { label: 'Unassigned', value: ar.unassignedCount, icon: UserX, color: 'text-orange-500', href: '/threats?filter=unassigned' },
                  { label: 'My Open Items', value: ar.myOpenAssignedCount, icon: Inbox, color: 'text-primary', href: '/threats?filter=mine' },
                ].map(tile => (
                  <Link key={tile.label} href={tile.href} className="block">
                    <div className="bg-muted/30 rounded-lg p-3 border border-border/30 hover:border-border transition-colors">
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">{tile.label}</p>
                        <tile.icon className={`w-3.5 h-3.5 ${tile.color}`} />
                      </div>
                      <p className="text-2xl font-display font-bold mt-1">{tile.value ?? 0}</p>
                    </div>
                  </Link>
                ))}
              </div>
              <div className="space-y-1">
                {(ar.items ?? []).length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-6">Nothing needs action right now 🎉</p>
                )}
                {(ar.items ?? []).map((item) => (
                  <Link key={item.id} href={`/threats/${item.id}`} className="block">
                    <div className="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-muted/50 transition-colors group">
                      <Badge className={`text-[10px] font-mono px-2 py-0.5 ${severityBadgeVariant[item.severity] ?? ''}`}>{item.severity ?? 'UNKNOWN'}</Badge>
                      <Badge className={`text-[10px] px-2 py-0.5 ${statusBadgeClass(item.status)}`}>{statusLabel(item.status)}</Badge>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate group-hover:text-primary transition-colors">{item.title ?? 'Untitled'}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {item.assignedTo ? (
                            <span className="text-[10px] text-muted-foreground truncate">{item.assignedTo.name || item.assignedTo.email}</span>
                          ) : (
                            <span className="text-[10px] text-orange-500">Unassigned</span>
                          )}
                          {item.dueDate && (
                            <span className={`text-[10px] flex items-center gap-1 ${item.overdue ? 'text-red-500 font-medium' : 'text-muted-foreground'}`}>
                              <Clock className="w-3 h-3" />
                              {item.overdue ? 'Overdue' : 'Due'} {new Date(item.dueDate).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </SlideIn>
      )}

      {/* Highest Risk Threats */}
      {ri && (
        <SlideIn from="bottom">
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-red-500" /> Highest Risk Threats
                </CardTitle>
                <Link href="/threats" className="text-xs text-primary hover:underline flex items-center gap-1">View all <ArrowRight className="w-3 h-3" /></Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                {(ri.highRiskThreats ?? []).length === 0 && (
                  <p className="text-sm text-muted-foreground py-2">No scored threats yet. Run enrichment to populate risk scores.</p>
                )}
                {(ri.highRiskThreats ?? []).map((item) => (
                  <Link key={item.id} href={`/threats/${item.id}`} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/40 transition-colors">
                    <div className={`w-11 text-center flex-shrink-0 rounded-md py-1 text-sm font-mono font-bold border ${riskScore100BadgeClass(item.riskScore)}`}>
                      {item.riskScore != null ? Math.round(item.riskScore) : '—'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{item.title}</p>
                      <p className="text-xs text-muted-foreground font-mono">{item.threatId}</p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {item.isKev && <Badge variant="outline" className="text-[9px] bg-red-500/15 text-red-500 border-red-500/30">KEV</Badge>}
                      {typeof item.epssPercentile === 'number' && (
                        <span className="text-[10px] text-muted-foreground font-mono">EPSS {Math.round(item.epssPercentile * 100)}%</span>
                      )}
                      <Badge variant="outline" className={`text-[10px] ${statusBadgeClass(item.status)}`}>{statusLabel(item.status)}</Badge>
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </SlideIn>
      )}
    </div>
  );

  // ---------- Shared analytics (charts) ----------
  const analyticsBlock = (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <SlideIn from="left">
        <Card className="border-border/50">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Severity Distribution</CardTitle></CardHeader>
          <CardContent><div className="h-72"><SeverityChart data={bySeverity} /></div></CardContent>
        </Card>
      </SlideIn>
      <SlideIn from="right">
        <Card className="border-border/50">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">14-Day Threat Trend</CardTitle></CardHeader>
          <CardContent><div className="h-72"><TrendChart data={trendData} /></div></CardContent>
        </Card>
      </SlideIn>
    </div>
  );

  return (
    <div className="p-6 space-y-6 max-w-[1200px] mx-auto">
      {/* Header */}
      <FadeIn>
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-display font-bold tracking-tight flex items-center gap-2">
              <Activity className="w-6 h-6 text-primary" /> Command Center
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Your complete org security picture — threats, risk, exposure &amp; compliance
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1.5 text-xs">
              <Briefcase className="w-3 h-3" /> {roleLabel}
            </Badge>
            <Button size="sm" variant="outline" className="gap-1.5 text-xs" disabled={refreshing}
              onClick={() => { setRefreshing(true); fetchAll(); }}>
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
            </Button>
          </div>
        </div>
      </FadeIn>

      {/* Hero KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {heroCards.map((card, i) => (
          <SlideIn key={card.label} from="bottom" delay={i * 0.05}>
            <Card className="border-border/50">
              <CardContent className="pt-5 pb-4 px-5">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider truncate">{card.label}</p>
                    <p className="text-3xl font-display font-bold mt-1">{card.value}</p>
                  </div>
                  <div className={`w-10 h-10 rounded-lg ${card.bg} flex items-center justify-center flex-shrink-0`}>
                    <card.icon className={`w-5 h-5 ${card.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </SlideIn>
        ))}
      </div>

      {/* Top Affected Products — prominent section for both analysts & executives */}
      {brief?.affectedProducts && brief.affectedProducts.length > 0 && (
        <SlideIn from="bottom">
          <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Package className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      Top Affected Products
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Products with the highest risk exposure across your portfolio
                    </p>
                  </div>
                </div>
                <Link href="/product-portfolio">
                  <Button size="sm" variant="outline" className="gap-1.5">
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
                    // Full static class strings so Tailwind's JIT picks them up.
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
                          {/* Accent stripe */}
                          <div className={`absolute top-0 left-0 right-0 h-1 ${stripeClass}`} />
                          
                          <div className="p-4 pt-5">
                            {/* Risk score badge */}
                            <div className="flex items-start justify-between gap-3 mb-3">
                              <div className="min-w-0 flex-1">
                                <h3 className="font-semibold text-sm truncate group-hover:text-primary transition-colors">
                                  {p.productName}
                                </h3>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                                    {p.department || 'Unknown Dept'}
                                  </Badge>
                                </div>
                              </div>
                              <div className={`flex-shrink-0 w-14 h-14 rounded-lg flex flex-col items-center justify-center border-2 ${riskScore100BadgeClass(p.maxRisk)}`}>
                                <span className="text-xl font-display font-bold leading-none">{Math.round(p.maxRisk)}</span>
                                <span className="text-[9px] uppercase tracking-wider mt-0.5 opacity-80">Risk</span>
                              </div>
                            </div>

                            {/* Threat count */}
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

      {/* Role-adaptive ordering: everyone sees everything, order reflects the role's priorities */}
      {execFirst ? (
        <>{executiveBlock}{analyticsBlock}{operationalBlock}</>
      ) : (
        <>{operationalBlock}{analyticsBlock}{executiveBlock}</>
      )}
    </div>
  );
}
