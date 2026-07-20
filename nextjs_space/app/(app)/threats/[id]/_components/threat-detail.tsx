'use client';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Bug, Crosshair, Activity, Calendar, Globe, Server, Shield, Trash2, Mail, Send, Ticket, Copy, Check, ChevronDown, Plus, Link2, Package, X, ExternalLink, Search, Flame } from 'lucide-react';
import { FadeIn } from '@/components/ui/animate';
import type { ThreatItem } from '@/lib/types';
import { toast } from 'sonner';
import Link from 'next/link';
import { computeRiskScore, riskScoreBadgeClass, riskScoreLabel } from '@/lib/risk-score';
import CreateTicketModal from '@/app/(app)/jira-tickets/_components/create-ticket-modal';

const severityBadge: Record<string, string> = {
  CRITICAL: 'bg-red-500/10 text-red-500 border-red-500/20',
  HIGH: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  MEDIUM: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  LOW: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
};

const statusBadge: Record<string, string> = {
  NEW: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  INVESTIGATING: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  RESOLVED: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
};

const typeIcons: Record<string, any> = { CVE: Bug, IOC: Crosshair, TTP: Activity };

export default function ThreatDetail({ id }: { id: string }) {
  const { data: session } = useSession() || {};
  const user = session?.user as any;
  const router = useRouter();
  const [threat, setThreat] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [createTicketOpen, setCreateTicketOpen] = useState(false);

  const fetchThreat = async () => {
    try {
      const res = await fetch(`/api/threats/${id}`);
      if (res.ok) {
        const data = await res.json();
        setThreat(data?.threat ?? null);
      }
    } catch (err: any) {
      console.error('Fetch threat detail error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!id) return;
    fetchThreat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const updateStatus = async (newStatus: string) => {
    try {
      const res = await fetch(`/api/threats/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        const data = await res.json();
        setThreat(data?.threat ?? null);
        toast.success('Status updated');
      } else {
        toast.error('Failed to update');
      }
    } catch {
      toast.error('Failed');
    }
  };

  const deleteThreat = async () => {
    if (!confirm('Are you sure you want to delete this threat?')) return;
    try {
      const res = await fetch(`/api/threats/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Threat deleted');
        router.replace('/threats');
      } else {
        const data = await res.json();
        toast.error(data?.error ?? 'Failed to delete');
      }
    } catch {
      toast.error('Failed');
    }
  };

  if (loading) return <div className="p-6"><div className="h-64 bg-muted animate-pulse rounded-xl" /></div>;
  if (!threat) return (
    <div className="p-6 text-center">
      <p className="text-muted-foreground">Threat not found</p>
      <Link href="/threats"><Button variant="outline" className="mt-4">Back to Threats</Button></Link>
    </div>
  );

  const TypeIcon = typeIcons[threat?.type] ?? Bug;
  const riskScore = computeRiskScore({ cvssScore: threat?.cvssScore, severity: threat?.severity, source: threat?.source });

  return (
    <div className="p-6 space-y-6 max-w-[1000px] mx-auto">
      <FadeIn>
        <div className="flex items-center gap-4">
          <Link href="/threats">
            <Button variant="ghost" size="icon-sm"><ArrowLeft className="w-4 h-4" /></Button>
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <TypeIcon className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm font-mono text-primary">{threat?.threatId ?? ''}</span>
              <Badge variant="outline" className={`text-[10px] ${severityBadge[threat?.severity] ?? ''}`}>{threat?.severity ?? ''}</Badge>
              <Badge variant="outline" className={`text-[10px] ${statusBadge[threat?.status] ?? ''}`}>{threat?.status ?? ''}</Badge>
              <Badge variant="outline" className={`text-[10px] font-mono gap-1 ${riskScoreBadgeClass(riskScore)}`} title="ThreatPulse Risk Score">
                <Shield className="w-3 h-3" /> Risk {riskScore.toFixed(1)} · {riskScoreLabel(riskScore)}
              </Badge>
            </div>
            <h1 className="text-xl font-display font-bold tracking-tight mt-1">{threat?.title ?? 'Untitled'}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Select value={threat?.status ?? 'NEW'} onValueChange={updateStatus}>
              <SelectTrigger className="w-[150px] h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="NEW">New</SelectItem>
                <SelectItem value="INVESTIGATING">Investigating</SelectItem>
                <SelectItem value="RESOLVED">Resolved</SelectItem>
              </SelectContent>
            </Select>
            {(user?.role === 'ADMIN' || user?.role === 'SUPERADMIN') && (
              <Button variant="destructive" size="sm" onClick={deleteThreat} className="gap-1">
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>
      </FadeIn>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <FadeIn delay={0.05} className="lg:col-span-2">
          <Card className="border-border/50">
            <CardHeader className="pb-3"><CardTitle className="text-sm">Description</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground leading-relaxed">{threat?.description ?? 'No description available.'}</p>
            </CardContent>
          </Card>
        </FadeIn>

        <FadeIn delay={0.1}>
          <Card className="border-border/50">
            <CardHeader className="pb-3"><CardTitle className="text-sm">Details</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {threat?.cvssScore != null && (
                <DetailRow icon={Shield} label="CVSS Score" value={String(threat.cvssScore)} />
              )}
              {threat?.source && <DetailRow icon={Globe} label="Source" value={threat.source} />}
              {threat?.affectedAssets && <DetailRow icon={Server} label="Affected Assets" value={threat.affectedAssets} />}
              {threat?.dateAdded && <DetailRow icon={Calendar} label="Date Added" value={new Date(threat.dateAdded).toLocaleDateString()} />}
              {threat?.mitreTactic && <DetailRow icon={Activity} label="MITRE Tactic" value={threat.mitreTactic} />}
              {threat?.mitreTechnique && <DetailRow icon={Activity} label="MITRE Technique" value={threat.mitreTechnique} />}
            </CardContent>
          </Card>
        </FadeIn>
      </div>

      {threat?.indicators && (
        <FadeIn delay={0.15}>
          <Card className="border-border/50">
            <CardHeader className="pb-3"><CardTitle className="text-sm">Indicators</CardTitle></CardHeader>
            <CardContent>
              <div className="bg-muted/50 rounded-lg p-4 font-mono text-xs leading-relaxed break-all">
                {threat.indicators}
              </div>
            </CardContent>
          </Card>
        </FadeIn>
      )}

      {/* Jira Tickets */}
      <JiraTicketsSection
        tickets={threat?.jiraTickets ?? []}
        onCreate={() => setCreateTicketOpen(true)}
        onChange={fetchThreat}
      />

      {/* Linked Assets */}
      <LinkedAssetsSection
        threatId={threat?.id}
        links={threat?.assetLinks ?? []}
        onChange={fetchThreat}
      />

      {/* Threat Advisory Export */}
      <ThreatAdvisoryExport threat={threat} />

      <CreateTicketModal
        open={createTicketOpen}
        onOpenChange={setCreateTicketOpen}
        threat={threat}
        onSuccess={fetchThreat}
      />
    </div>
  );
}

const priorityBadge: Record<string, string> = {
  Critical: 'bg-red-500/10 text-red-500 border-red-500/20',
  High: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  Medium: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  Low: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
};

const ticketStatusBadge: Record<string, string> = {
  DRAFT: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  CREATED: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  IN_PROGRESS: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  RESOLVED: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  CLOSED: 'bg-muted text-muted-foreground border-border',
};

function JiraTicketsSection({ tickets, onCreate, onChange }: { tickets: any[]; onCreate: () => void; onChange: () => void }) {
  const deleteTicket = async (ticketId: string) => {
    try {
      const res = await fetch(`/api/jira-tickets/${ticketId}`, { method: 'DELETE' });
      if (res.ok) { toast.success('Ticket deleted'); onChange(); }
      else toast.error('Failed to delete ticket');
    } catch { toast.error('Failed to delete ticket'); }
  };

  return (
    <FadeIn delay={0.16}>
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Ticket className="w-4 h-4 text-primary" /> Jira Tickets
              <span className="text-xs text-muted-foreground font-normal">({tickets?.length ?? 0})</span>
            </CardTitle>
            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={onCreate}>
              <Plus className="w-3.5 h-3.5" /> Create Ticket
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {(tickets?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No tickets yet. Create one to track remediation.</p>
          ) : (
            <div className="space-y-2">
              {tickets.map((t: any) => (
                <div key={t.id} className="flex items-center gap-3 rounded-lg border border-border/50 bg-muted/20 px-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {t.jiraKey ? <span className="font-mono text-xs text-primary">{t.jiraKey}</span> : <Badge variant="outline" className="text-[10px] bg-slate-500/10 text-slate-400 border-slate-500/20">DRAFT</Badge>}
                      <span className="text-sm font-medium truncate">{t.title}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className={`text-[10px] ${priorityBadge[t.priority] ?? ''}`}>{t.priority}</Badge>
                      <Badge variant="outline" className={`text-[10px] ${ticketStatusBadge[t.status] ?? ''}`}>{String(t.status).replace('_', ' ')}</Badge>
                      {t.productOwner && <span className="text-[10px] text-muted-foreground">· {t.productOwner}</span>}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon-sm" onClick={() => deleteTicket(t.id)}><Trash2 className="w-3.5 h-3.5 text-red-500" /></Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </FadeIn>
  );
}

function LinkedAssetsSection({ threatId, links, onChange }: { threatId: string; links: any[]; onChange: () => void }) {
  const [assets, setAssets] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const [linking, setLinking] = useState(false);

  useEffect(() => {
    if (!showPicker) return;
    (async () => {
      try {
        const res = await fetch('/api/cybellum/assets');
        if (res.ok) {
          const data = await res.json();
          setAssets(data?.assets ?? []);
        }
      } catch { /* ignore */ }
    })();
  }, [showPicker]);

  const linkedAssetIds = new Set((links ?? []).map((l: any) => l.assetId));
  const candidates = (assets ?? []).filter((a: any) => {
    if (linkedAssetIds.has(a.id)) return false;
    if (!query) return true;
    const hay = `${a.productName} ${a.packageName ?? ''}`.toLowerCase();
    return hay.includes(query.toLowerCase());
  });

  const linkAsset = async (assetId: string) => {
    setLinking(true);
    try {
      const res = await fetch(`/api/cybellum/assets/${assetId}/link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threatId }),
      });
      if (res.ok) {
        toast.success('Asset linked');
        setQuery(''); setShowPicker(false);
        onChange();
      } else {
        const data = await res.json();
        toast.error(data?.error ?? 'Failed to link asset');
      }
    } catch { toast.error('Failed to link asset'); }
    finally { setLinking(false); }
  };

  const unlinkAsset = async (assetId: string) => {
    try {
      const res = await fetch(`/api/cybellum/assets/${assetId}/link?threatId=${threatId}`, { method: 'DELETE' });
      if (res.ok) { toast.success('Asset unlinked'); onChange(); }
      else toast.error('Failed to unlink asset');
    } catch { toast.error('Failed to unlink asset'); }
  };

  return (
    <FadeIn delay={0.18}>
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Package className="w-4 h-4 text-primary" /> Linked Assets
              <span className="text-xs text-muted-foreground font-normal">({links?.length ?? 0})</span>
            </CardTitle>
            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setShowPicker((v) => !v)}>
              {showPicker ? <><X className="w-3.5 h-3.5" /> Cancel</> : <><Link2 className="w-3.5 h-3.5" /> Link Asset</>}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {showPicker && (
            <div className="rounded-lg border border-border/50 bg-muted/20 p-3 space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Search Cybellum assets..." value={query} onChange={(e: any) => setQuery(e.target.value)} className="pl-10 h-9" />
              </div>
              <div className="max-h-[220px] overflow-y-auto space-y-1">
                {candidates.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-3">No matching assets. Add assets in Product Portfolio.</p>
                ) : candidates.map((a: any) => (
                  <button
                    key={a.id}
                    disabled={linking}
                    onClick={() => linkAsset(a.id)}
                    className="w-full flex items-center justify-between gap-2 rounded-md px-3 py-2 text-left hover:bg-muted/50 transition-colors disabled:opacity-50"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{a.productName}{a.productVersion ? ` v${a.productVersion}` : ''}</p>
                      {a.packageName && <p className="text-xs text-muted-foreground font-mono truncate">{a.packageName}{a.packageVersion ? ` ${a.packageVersion}` : ''}</p>}
                    </div>
                    <Plus className="w-4 h-4 text-primary shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {(links?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No linked assets. Link Cybellum assets affected by this threat.</p>
          ) : (
            <div className="space-y-2">
              {links.map((l: any) => (
                <div key={l.id} className="flex items-center gap-3 rounded-lg border border-border/50 bg-muted/20 px-3 py-2.5">
                  <Package className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {l.asset?.productName}{l.asset?.productVersion ? ` v${l.asset.productVersion}` : ''}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {l.asset?.packageName && <span className="font-mono">{l.asset.packageName}{l.asset?.packageVersion ? ` ${l.asset.packageVersion}` : ''}</span>}
                      {l.asset?.productOwner && <span>· {l.asset.productOwner}</span>}
                    </div>
                  </div>
                  {l.asset?.id && (
                    <Link href="/product-portfolio"><Button variant="ghost" size="icon-sm"><ExternalLink className="w-3.5 h-3.5" /></Button></Link>
                  )}
                  <Button variant="ghost" size="icon-sm" onClick={() => unlinkAsset(l.assetId)}><X className="w-3.5 h-3.5 text-red-500" /></Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </FadeIn>
  );
}

function ThreatAdvisoryExport({ threat }: { threat: ThreatItem }) {
  const [showPreview, setShowPreview] = useState(false);
  const [copied, setCopied] = useState(false);

  const buildAdvisory = () => {
    const lines = [
      `THREAT ADVISORY`,
      `${'='.repeat(50)}`,
      `Title: ${threat.title}`,
      `Type: ${threat.type}`,
      `Severity: ${threat.severity}`,
      `ID: ${threat.threatId}`,
      threat.cvssScore != null ? `CVSS Score: ${threat.cvssScore}` : '',
      `Source: ${threat.source || 'N/A'}`,
      `Date Published: ${new Date(threat.dateAdded).toLocaleDateString()}`,
      `Status: ${threat.status}`,
      threat.affectedAssets ? `Affected Assets: ${threat.affectedAssets}` : '',
      threat.mitreTactic ? `MITRE Tactic: ${threat.mitreTactic}` : '',
      threat.mitreTechnique ? `MITRE Technique: ${threat.mitreTechnique}` : '',
      ``,
      `DESCRIPTION`,
      `${'-'.repeat(50)}`,
      threat.description || 'No description available.',
      ``,
      threat.indicators ? `INDICATORS\n${'-'.repeat(50)}\n${threat.indicators}` : '',
      ``,
      `--- Generated by ThreatPulse Intel ---`,
    ].filter(Boolean).join('\n');
    return lines;
  };

  const handleEmailExport = () => {
    const advisory = buildAdvisory();
    const subject = encodeURIComponent(`[ThreatPulse] ${threat.severity} - ${threat.threatId}: ${threat.title}`);
    const body = encodeURIComponent(advisory);
    window.open(`mailto:?subject=${subject}&body=${body}`, '_self');
    toast.success('Email client opened');
  };

  const handleTeamsExport = () => {
    const advisory = buildAdvisory();
    navigator.clipboard.writeText(advisory).then(() => {
      toast.success('Advisory copied to clipboard — paste into Teams');
    }).catch(() => {
      toast.error('Failed to copy');
    });
  };

  const handleCopyAdvisory = () => {
    const advisory = buildAdvisory();
    navigator.clipboard.writeText(advisory).then(() => {
      setCopied(true);
      toast.success('Advisory copied');
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      toast.error('Failed to copy');
    });
  };

  return (
    <FadeIn delay={0.2}>
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Send className="w-4 h-4 text-primary" />
              Threat Advisory Export
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs gap-1"
              onClick={() => setShowPreview(!showPreview)}
            >
              {showPreview ? 'Hide' : 'Show'} Preview
              <ChevronDown className={`w-3 h-3 transition-transform ${showPreview ? 'rotate-180' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleEmailExport}>
              <Mail className="w-3.5 h-3.5" /> Email Export
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleTeamsExport}>
              <Send className="w-3.5 h-3.5" /> Teams Export
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleCopyAdvisory}>
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied!' : 'Copy Advisory'}
            </Button>
          </div>
          {showPreview && (
            <div className="bg-muted/30 rounded-lg p-4 border border-border/30">
              <pre className="font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-muted-foreground">{buildAdvisory()}</pre>
            </div>
          )}
        </CardContent>
      </Card>
    </FadeIn>
  );
}

function DetailRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
      <div>
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className="text-sm">{value}</p>
      </div>
    </div>
  );
}
