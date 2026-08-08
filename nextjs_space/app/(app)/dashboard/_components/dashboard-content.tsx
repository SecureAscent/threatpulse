'use client';
import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Shield, AlertTriangle, TrendingUp, Clock, Zap, RefreshCw, Filter, Settings, ExternalLink, Eye, UserX, CalendarClock, Inbox } from 'lucide-react';
import { FadeIn, SlideIn } from '@/components/ui/animate';
import type { ThreatItem } from '@/lib/types';
import { statusBadgeClass, statusLabel } from '@/lib/threat-status';
import { riskScore100BadgeClass } from '@/lib/risk-score';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { toast } from 'sonner';

const SeverityChart = dynamic(() => import('./severity-chart'), { ssr: false, loading: () => <div className="h-64 animate-pulse bg-muted rounded-lg" /> });
const BySourceChart = dynamic(() => import('./by-source-chart'), { ssr: false, loading: () => <div className="h-64 animate-pulse bg-muted rounded-lg" /> });
const TrendChart = dynamic(() => import('./trend-chart'), { ssr: false, loading: () => <div className="h-64 animate-pulse bg-muted rounded-lg" /> });

const severityBadgeVariant: Record<string, string> = {
  CRITICAL: 'bg-red-500/10 text-red-500 border-red-500/20',
  HIGH: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  MEDIUM: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  LOW: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
};

interface ActionRequiredItem {
  id: string;
  threatId?: string | null;
  title: string;
  severity: string;
  status: string;
  dueDate?: string | null;
  tags?: string[];
  assignedTo?: { id: string; name?: string | null; email: string } | null;
  overdue?: boolean;
}

interface ActionRequiredSummary {
  actionRequiredCount: number;
  openCount: number;
  unassignedCount: number;
  overdueCount: number;
  myAssignedCount: number;
  myOpenAssignedCount: number;
  items: ActionRequiredItem[];
}

interface HighRiskItem {
  id: string;
  threatId?: string | null;
  title: string;
  severity: string;
  status: string;
  riskScore: number | null;
  epssPercentile: number | null;
  isKev: boolean;
  exploitAvailable: boolean;
}

interface RiskInsights {
  avgRiskScore: number;
  kevCount: number;
  scoredCount: number;
  highRiskThreats: HighRiskItem[];
}

interface DashboardData {
  total: number;
  bySeverity: Record<string, number>;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
  bySource: Record<string, number>;
  todayCount: number;
  trendData: any[];
  recentThreats: ThreatItem[];
  actionRequired?: ActionRequiredSummary;
  riskInsights?: RiskInsights;
}

export default function DashboardContent() {
  const { data: session } = useSession() || {};
  const [stats, setStats] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [collecting, setCollecting] = useState(false);
  const user = session?.user as any;

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err: any) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const handleCollect = async () => {
    setCollecting(true);
    try {
      const res = await fetch('/api/admin/collector-health/trigger', { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        const msg = data.totalInserted !== undefined && data.totalUpdated !== undefined
          ? `Collection complete: ${data.totalInserted} new, ${data.totalUpdated} updated.`
          : data.message || 'Collection triggered successfully.';
        toast.success(msg, { duration: 5000 });
        fetchStats();
      } else {
        toast.error(data.error || 'Collection failed', { duration: 5000 });
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to trigger collection', { duration: 5000 });
    } finally {
      setCollecting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="h-8 w-64 bg-muted animate-pulse rounded" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map((i: number) => <div key={i} className="h-28 bg-muted animate-pulse rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1,2].map(i => <div key={i} className="h-72 bg-muted animate-pulse rounded-xl" />)}
        </div>
      </div>
    );
  }

  const total = stats?.total ?? 0;
  const bySeverity = stats?.bySeverity ?? {};
  const bySource = stats?.bySource ?? {};
  const todayCount = stats?.todayCount ?? 0;
  const trendData = stats?.trendData ?? [];
  const recentThreats = stats?.recentThreats ?? [];
  const actionRequired = stats?.actionRequired;
  const riskInsights = stats?.riskInsights;

  const metricCards = [
    { label: 'Total Threats', value: total, href: '/threats', icon: Shield, color: 'text-primary', bgColor: 'bg-primary/10' },
    { label: 'Critical', value: bySeverity?.CRITICAL ?? 0, pct: total ? Math.round((bySeverity?.CRITICAL ?? 0) / total * 100) : 0, href: '/threats?severity=CRITICAL', icon: AlertTriangle, color: 'text-red-500', bgColor: 'bg-red-500/10' },
    { label: 'High Severity', value: bySeverity?.HIGH ?? 0, pct: total ? Math.round((bySeverity?.HIGH ?? 0) / total * 100) : 0, href: '/threats?severity=HIGH', icon: Zap, color: 'text-orange-500', bgColor: 'bg-orange-500/10' },
    { label: 'Today', value: todayCount, href: '/threat-feed', icon: TrendingUp, color: 'text-emerald-500', bgColor: 'bg-emerald-500/10' },
  ];

  return (
    <div className="p-6 space-y-6 max-w-[1200px] mx-auto">
      <SetupBanner role={user?.role} />
      {/* Header */}
      <FadeIn>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold tracking-tight">Threat Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Real-time threat intelligence overview</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/threat-feed">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                <Filter className="w-3.5 h-3.5" /> Filter by date
              </Button>
            </Link>
            <Link href="/admin">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                <Settings className="w-3.5 h-3.5" /> Customize
              </Button>
            </Link>
            <Button size="sm" className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleCollect} disabled={collecting}>
              <RefreshCw className={`w-3.5 h-3.5 ${collecting ? 'animate-spin' : ''}`} />
              {collecting ? 'Collecting...' : 'Collect Now'}
            </Button>
          </div>
        </div>
      </FadeIn>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {(metricCards ?? []).map((card: any, i: number) => (
          <SlideIn key={card?.label} from="bottom" delay={i * 0.05}>
            <Link href={card?.href || '/threats'}>
              <Card className="border-border/50 hover:border-border transition-colors cursor-pointer group">
                <CardContent className="pt-5 pb-4 px-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">{card?.label}</p>
                      <p className="text-3xl font-display font-bold mt-1">
                        <AnimatedCounter value={card?.value ?? 0} />
                      </p>
                      {card?.pct !== undefined && (
                        <p className="text-xs text-muted-foreground mt-0.5">{card.pct}% of total</p>
                      )}
                    </div>
                    <div className={`w-10 h-10 rounded-lg ${card?.bgColor} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                      <card.icon className={`w-5 h-5 ${card?.color}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </SlideIn>
        ))}
      </div>

      {/* Action Required Workflow Widget */}
      {actionRequired && (
        <SlideIn from="bottom" delay={0.08}>
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" /> Action Required
                </CardTitle>
                <Link href="/threats?filter=action_required" className="text-xs text-primary hover:underline">View queue →</Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Workflow stat tiles */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'Action Required', value: actionRequired.actionRequiredCount, icon: AlertTriangle, color: 'text-amber-500', href: '/threats?filter=action_required' },
                  { label: 'Overdue', value: actionRequired.overdueCount, icon: CalendarClock, color: 'text-red-500', href: '/threats?filter=overdue' },
                  { label: 'Unassigned', value: actionRequired.unassignedCount, icon: UserX, color: 'text-orange-500', href: '/threats?filter=unassigned' },
                  { label: 'My Open Items', value: actionRequired.myOpenAssignedCount, icon: Inbox, color: 'text-primary', href: '/threats?filter=mine' },
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

              {/* Top action items */}
              <div className="space-y-1">
                {(actionRequired.items ?? []).length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-6">Nothing needs action right now 🎉</p>
                )}
                {(actionRequired.items ?? []).map((item: ActionRequiredItem) => (
                  <Link key={item.id} href={`/threats/${item.id}`} className="block">
                    <div className="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-muted/50 transition-colors group">
                      <Badge className={`text-[10px] font-mono px-2 py-0.5 ${severityBadgeVariant[item.severity] ?? ''}`}>
                        {item.severity ?? 'UNKNOWN'}
                      </Badge>
                      <Badge className={`text-[10px] px-2 py-0.5 ${statusBadgeClass(item.status)}`}>
                        {statusLabel(item.status)}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate group-hover:text-primary transition-colors">
                          {item.title ?? 'Untitled'}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {item.assignedTo ? (
                            <span className="text-[10px] text-muted-foreground truncate">
                              {item.assignedTo.name || item.assignedTo.email}
                            </span>
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

      {/* Risk Intelligence: highest-scoring threats */}
      {riskInsights && (
        <SlideIn from="bottom" delay={0.08}>
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-red-500" /> Highest Risk Threats
                </CardTitle>
                <Link href="/threats" className="text-xs text-primary hover:underline">View all →</Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-muted/30 rounded-lg p-3 border border-border/30">
                  <p className="text-xs text-muted-foreground">Avg Risk Score</p>
                  <p className="text-2xl font-display font-bold mt-1">{riskInsights.avgRiskScore}</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-3 border border-border/30">
                  <p className="text-xs text-muted-foreground">Known Exploited (KEV)</p>
                  <p className="text-2xl font-display font-bold mt-1 text-red-500">{riskInsights.kevCount}</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-3 border border-border/30">
                  <p className="text-xs text-muted-foreground">Scored Threats</p>
                  <p className="text-2xl font-display font-bold mt-1">{riskInsights.scoredCount}</p>
                </div>
              </div>
              <div className="space-y-1.5">
                {(riskInsights.highRiskThreats ?? []).length === 0 && (
                  <p className="text-sm text-muted-foreground py-2">No scored threats yet. Run enrichment to populate risk scores.</p>
                )}
                {(riskInsights.highRiskThreats ?? []).map((item: HighRiskItem) => (
                  <Link key={item.id} href={`/threats/${item.id}`}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/40 transition-colors">
                    <div className={`w-11 text-center flex-shrink-0 rounded-md py-1 text-sm font-mono font-bold border ${riskScore100BadgeClass(item.riskScore)}`}>
                      {item.riskScore != null ? Math.round(item.riskScore) : '—'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{item.title}</p>
                      <p className="text-xs text-muted-foreground font-mono">{item.threatId}</p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {item.isKev && (
                        <Badge variant="outline" className="text-[9px] bg-red-500/15 text-red-500 border-red-500/30">KEV</Badge>
                      )}
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

      {/* Cybellum Product Risk */}
      <SlideIn from="bottom" delay={0.1}>
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-500" /> Cybellum Product Risk
              </CardTitle>
              <Link href="/product-portfolio" className="text-xs text-primary hover:underline">View all →</Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Products', value: 0 },
                { label: 'High Risk (≥7)', value: 0 },
                { label: 'Avg Risk Score', value: 0 },
                { label: 'Scan Ready', value: 0 },
              ].map(item => (
                <div key={item.label} className="bg-muted/30 rounded-lg p-3 border border-border/30">
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className="text-2xl font-display font-bold mt-1">{item.value}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </SlideIn>

      {/* Charts Row: Severity Distribution + By Source */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SlideIn from="left" delay={0.15}>
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Severity Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <SeverityChart data={bySeverity} />
              </div>
            </CardContent>
          </Card>
        </SlideIn>
        <SlideIn from="right" delay={0.2}>
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">By Source</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <BySourceChart data={bySource} />
              </div>
            </CardContent>
          </Card>
        </SlideIn>
      </div>

      {/* 14-Day Threat Trend */}
      <SlideIn from="bottom" delay={0.25}>
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">14-Day Threat Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <TrendChart data={trendData} />
            </div>
          </CardContent>
        </Card>
      </SlideIn>

      {/* Latest Threats */}
      <FadeIn delay={0.3}>
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">Latest Threats</CardTitle>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">Newest first</span>
                <Link href="/threat-feed" className="text-xs text-primary hover:underline">View all</Link>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {(recentThreats ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">No threats recorded yet</p>
              )}
              {(recentThreats ?? []).map((threat: ThreatItem) => (
                <Link key={threat?.id} href={`/threats/${threat?.id}`} className="block">
                  <div className="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-muted/50 transition-colors group">
                    <Badge className={`text-[10px] font-mono px-2 py-0.5 ${severityBadgeVariant[threat?.severity] ?? ''}`}>
                      {threat?.severity ?? 'UNKNOWN'}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider w-32 flex-shrink-0 truncate">
                      {threat?.source ?? 'Unknown'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate group-hover:text-primary transition-colors">
                        {threat?.title ?? 'Untitled'}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {threat?.dateAdded ? formatRelativeTime(threat.dateAdded) : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon-sm" className="h-7 w-7">
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" className="h-7 w-7">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  );
}

function AnimatedCounter({ value }: { value: number }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (value <= 0) { setCount(0); return; }
    const duration = 800;
    const step = Math.max(1, Math.floor(value / (duration / 16)));
    let current = 0;
    const timer = setInterval(() => {
      current += step;
      if (current >= value) { setCount(value); clearInterval(timer); }
      else setCount(current);
    }, 16);
    return () => clearInterval(timer);
  }, [value]);
  return <>{count}</>;
}

function formatRelativeTime(dateStr: string) {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs} hour${diffHrs > 1 ? 's' : ''} ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 30) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  return date.toLocaleDateString();
}


function SetupBanner({ role }: { role?: string }) {
  const [show, setShow] = useState(false);
  const canSee = role === 'SUPERADMIN' || role === 'ADMIN' || role === 'PARENT_ADMIN';

  useEffect(() => {
    if (!canSee) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/admin/setup');
        if (res.ok) {
          const d = await res.json();
          if (!cancelled) setShow(!d?.setupCompleted);
        }
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [canSee]);

  if (!canSee || !show) return null;

  return (
    <FadeIn>
      <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
        <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-medium">Finish setting up your organization</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Complete the security checklist — including enabling two-factor authentication for admins — to secure your account.
          </p>
        </div>
        <Link href="/admin/setup">
          <Button size="sm" variant="outline" className="border-amber-500/40">View checklist</Button>
        </Link>
      </div>
    </FadeIn>
  );
}
