'use client';
import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Crosshair, AlertTriangle, Package, Building2, Zap, Loader2, RefreshCw } from 'lucide-react';
import { FadeIn } from '@/components/ui/animate';

type GNode = {
  id: string;
  label: string;
  type: 'threat' | 'asset' | 'department';
  severity?: string;
  riskScore?: number | null;
  department?: string | null;
};
type GEdge = { source: string; target: string };
type Stats = {
  totalThreats: number;
  totalAffectedAssets: number;
  totalDepartments: number;
  mostExposedDepartment: string | null;
  mostExposedDepartmentCount: number;
};
type ThreatRow = {
  id: string;
  title: string;
  severity: string;
  riskScore?: number | null;
  isKev?: boolean;
  assetCount: number;
};

const W = 900;
const H = 620;
const CX = W / 2;
const CY = H / 2;

const severityColor = (sev?: string) => {
  switch ((sev || '').toUpperCase()) {
    case 'CRITICAL': return '#ef4444';
    case 'HIGH': return '#f97316';
    case 'MEDIUM': return '#eab308';
    case 'LOW': return '#10b981';
    default: return '#6b7280';
  }
};

const severityBadgeClass = (sev?: string) => {
  switch ((sev || '').toUpperCase()) {
    case 'CRITICAL': return 'bg-red-500/10 text-red-500 border-red-500/20';
    case 'HIGH': return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
    case 'MEDIUM': return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
    case 'LOW': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
    default: return 'bg-muted text-muted-foreground';
  }
};

export default function BlastRadiusContent() {
  const [nodes, setNodes] = useState<GNode[]>([]);
  const [edges, setEdges] = useState<GEdge[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [threats, setThreats] = useState<ThreatRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null); // threat.id

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/blast-radius');
      const data = await res.json();
      setNodes(data?.nodes ?? []);
      setEdges(data?.edges ?? []);
      setStats(data?.stats ?? null);
      setThreats(data?.threats ?? []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Compute positions: threats on inner ring, assets on middle ring, departments on outer ring.
  const positions = useMemo(() => {
    const pos = new Map<string, { x: number; y: number }>();
    const threatNodes = nodes.filter((n) => n.type === 'threat');
    const assetNodes = nodes.filter((n) => n.type === 'asset');
    const deptNodes = nodes.filter((n) => n.type === 'department');

    const place = (arr: GNode[], radius: number, offset = -Math.PI / 2) => {
      const n = arr.length;
      arr.forEach((node, i) => {
        const angle = offset + (2 * Math.PI * i) / Math.max(n, 1);
        pos.set(node.id, {
          x: CX + radius * Math.cos(angle),
          y: CY + radius * Math.sin(angle),
        });
      });
    };

    if (threatNodes.length === 1) {
      pos.set(threatNodes[0].id, { x: CX, y: CY });
    } else {
      place(threatNodes, 130);
    }
    place(assetNodes, 235);
    place(deptNodes, 300, -Math.PI / 2 + 0.15);
    return pos;
  }, [nodes]);

  // Highlight set: selected threat + its connected assets + their departments.
  const highlightIds = useMemo(() => {
    if (!selected) return null;
    const tId = `threat:${selected}`;
    const set = new Set<string>([tId]);
    for (const e of edges) {
      if (e.source === tId) {
        set.add(e.target);
        // asset -> department edges
        for (const e2 of edges) {
          if (e2.source === e.target) set.add(e2.target);
        }
      }
    }
    return set;
  }, [selected, edges]);

  const isDim = (id: string) => highlightIds != null && !highlightIds.has(id);
  const edgeActive = (e: GEdge) =>
    highlightIds == null || (highlightIds.has(e.source) && highlightIds.has(e.target));

  const hasData = nodes.length > 0;

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <FadeIn>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
              <Crosshair className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold tracking-tight">Blast Radius</h1>
              <p className="text-sm text-muted-foreground">Threat → asset exposure map across your organization</p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5 h-9" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Refresh
          </Button>
        </div>
      </FadeIn>

      {/* Stats bar */}
      <FadeIn delay={0.05}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Threats Mapped', value: stats?.totalThreats ?? 0, icon: AlertTriangle, color: 'text-orange-500' },
            { label: 'Affected Assets', value: stats?.totalAffectedAssets ?? 0, icon: Package, color: 'text-blue-500' },
            { label: 'Departments Exposed', value: stats?.totalDepartments ?? 0, icon: Building2, color: 'text-purple-500' },
            { label: 'Most Exposed', value: stats?.mostExposedDepartment ?? '—', icon: Zap, color: 'text-red-500', small: true },
          ].map((c) => (
            <Card key={c.label} className="border-border/50">
              <CardContent className="pt-5 pb-4 px-5">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">{c.label}</p>
                    <p className={`font-display font-bold mt-1 truncate ${c.small ? 'text-lg' : 'text-3xl'}`}>{c.value}</p>
                  </div>
                  <c.icon className={`w-6 h-6 flex-shrink-0 ${c.color}`} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </FadeIn>

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6">
        {/* Left panel: threat list */}
        <FadeIn delay={0.1}>
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-muted-foreground" />
                Threats ({threats.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 max-h-[540px] overflow-y-auto">
              {loading ? (
                <div className="space-y-2 p-4">
                  {[1, 2, 3, 4].map((i) => <div key={i} className="h-14 bg-muted animate-pulse rounded" />)}
                </div>
              ) : threats.length === 0 ? (
                <p className="text-sm text-muted-foreground p-4">No linked threats yet.</p>
              ) : (
                <div className="divide-y divide-border/40">
                  {selected && (
                    <button
                      className="w-full text-left px-4 py-2 text-xs text-primary hover:bg-muted/50"
                      onClick={() => setSelected(null)}
                    >
                      ← Show all
                    </button>
                  )}
                  {threats.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setSelected(selected === t.id ? null : t.id)}
                      className={`w-full text-left px-4 py-3 transition-colors hover:bg-muted/50 ${selected === t.id ? 'bg-primary/10' : ''}`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className={`text-[9px] ${severityBadgeClass(t.severity)}`}>
                          {t.severity}
                        </Badge>
                        {t.isKev && <Badge variant="outline" className="text-[9px] bg-red-500/10 text-red-500 border-red-500/20">KEV</Badge>}
                        <span className="text-[10px] text-muted-foreground ml-auto">{t.assetCount} asset{t.assetCount === 1 ? '' : 's'}</span>
                      </div>
                      <p className="text-xs font-medium line-clamp-2">{t.title}</p>
                      {typeof t.riskScore === 'number' && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">Risk {t.riskScore.toFixed(1)}</p>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </FadeIn>

        {/* Graph */}
        <FadeIn delay={0.15}>
          <Card className="border-border/50">
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm">Exposure Graph</CardTitle>
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" /> Threat</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-blue-500 inline-block" /> Asset</span>
                <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm bg-gray-400 inline-block" /> Department</span>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-[560px] bg-muted/40 animate-pulse rounded-lg" />
              ) : !hasData ? (
                <div className="h-[560px] flex flex-col items-center justify-center text-center">
                  <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-4">
                    <Crosshair className="w-7 h-7 text-muted-foreground" />
                  </div>
                  <h3 className="text-sm font-medium">No exposure links yet</h3>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                    Link threats to affected products from a threat's detail page (Linked Assets), then the
                    blast radius graph will map which products and departments are exposed.
                  </p>
                </div>
              ) : (
                <div className="w-full overflow-x-auto">
                  <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 640, height: 560 }}>
                    {/* edges */}
                    {edges.map((e, i) => {
                      const a = positions.get(e.source);
                      const b = positions.get(e.target);
                      if (!a || !b) return null;
                      const active = edgeActive(e);
                      return (
                        <line
                          key={i}
                          x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                          stroke={active ? '#94a3b8' : '#e2e8f0'}
                          strokeOpacity={active ? 0.7 : 0.15}
                          strokeWidth={active ? 1.5 : 1}
                        />
                      );
                    })}
                    {/* nodes */}
                    {nodes.map((n) => {
                      const p = positions.get(n.id);
                      if (!p) return null;
                      const dim = isDim(n.id);
                      if (n.type === 'threat') {
                        const r = 10 + Math.min(14, (typeof n.riskScore === 'number' ? n.riskScore : 5) * 1.4);
                        const tid = n.id.replace('threat:', '');
                        return (
                          <g key={n.id} opacity={dim ? 0.2 : 1} style={{ cursor: 'pointer' }}
                            onClick={() => setSelected(selected === tid ? null : tid)}>
                            <circle cx={p.x} cy={p.y} r={r} fill={severityColor(n.severity)} fillOpacity={0.85} stroke="#fff" strokeWidth={1.5} />
                            <text x={p.x} y={p.y - r - 4} textAnchor="middle" fontSize={9} fill="currentColor" className="fill-foreground">
                              {n.label.length > 22 ? n.label.slice(0, 22) + '…' : n.label}
                            </text>
                          </g>
                        );
                      }
                      if (n.type === 'asset') {
                        return (
                          <g key={n.id} opacity={dim ? 0.2 : 1}>
                            <rect x={p.x - 8} y={p.y - 8} width={16} height={16} rx={2} fill="#3b82f6" fillOpacity={0.85} stroke="#fff" strokeWidth={1.5} />
                            <text x={p.x} y={p.y + 20} textAnchor="middle" fontSize={8.5} fill="currentColor" className="fill-muted-foreground">
                              {n.label.length > 20 ? n.label.slice(0, 20) + '…' : n.label}
                            </text>
                          </g>
                        );
                      }
                      // department
                      const wLabel = Math.max(46, n.label.length * 6.2);
                      return (
                        <g key={n.id} opacity={dim ? 0.25 : 1}>
                          <rect x={p.x - wLabel / 2} y={p.y - 11} width={wLabel} height={22} rx={11} fill="#9ca3af" fillOpacity={0.2} stroke="#9ca3af" strokeOpacity={0.5} strokeWidth={1} />
                          <text x={p.x} y={p.y + 4} textAnchor="middle" fontSize={9.5} fill="currentColor" className="fill-foreground">
                            {n.label}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              )}
            </CardContent>
          </Card>
        </FadeIn>
      </div>
    </div>
  );
}
