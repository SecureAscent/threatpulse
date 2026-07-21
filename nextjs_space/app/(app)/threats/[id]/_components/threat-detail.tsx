'use client';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComp } from '@/components/ui/calendar';
import { ArrowLeft, Bug, Crosshair, Activity, Calendar, Globe, Server, Shield, Trash2, Mail, Send, Ticket, Copy, Check, ChevronDown, Plus, Link2, Package, X, ExternalLink, Search, Flame, UserPlus, Clock, MessageSquare, Tag, CalendarClock, History, Lock } from 'lucide-react';
import { FadeIn } from '@/components/ui/animate';
import type { ThreatItem, ThreatNoteItem, ThreatStatusHistoryItem } from '@/lib/types';
import { toast } from 'sonner';
import Link from 'next/link';
import { computeRiskScore, riskScore100BadgeClass, riskScore100Label } from '@/lib/risk-score';
import { describeMitreIds } from '@/lib/enrichment/mitre';
import CreateTicketModal from '@/app/(app)/jira-tickets/_components/create-ticket-modal';
import { THREAT_STATUS_ORDER, statusBadgeClass, statusLabel, statusMeta, isOverdue } from '@/lib/threat-status';
import { AnalystSelect, analystLabel, analystInitials } from '@/components/analyst-select';

const severityBadge: Record<string, string> = {
  CRITICAL: 'bg-red-500/10 text-red-500 border-red-500/20',
  HIGH: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  MEDIUM: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  LOW: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
};

const typeIcons: Record<string, any> = { CVE: Bug, IOC: Crosshair, TTP: Activity };

function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return '—';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function fmtDateTime(d: string | Date | null | undefined): string {
  if (!d) return '—';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

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

  const canManage = Boolean(user?.role) && user?.role !== 'VIEWER';

  const patchThreat = async (payload: Record<string, any>, successMsg?: string) => {
    try {
      const res = await fetch(`/api/threats/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        setThreat(data?.threat ?? null);
        if (successMsg) toast.success(successMsg);
        return true;
      }
      const data = await res.json().catch(() => ({}));
      toast.error(data?.error ?? 'Failed to update');
      return false;
    } catch {
      toast.error('Failed to update');
      return false;
    }
  };

  const updateStatus = (newStatus: string) => patchThreat({ status: newStatus }, 'Status updated');
  const assignTo = (assignedToId: string | null) =>
    patchThreat({ assignedToId }, assignedToId ? 'Threat assigned' : 'Assignee cleared');
  const updateDueDate = (dueDate: string | null) =>
    patchThreat({ dueDate }, dueDate ? 'Due date set' : 'Due date cleared');

  const addTag = async (raw: string) => {
    const tag = raw.trim();
    if (!tag) return;
    const current: string[] = threat?.tags ?? [];
    if (current.includes(tag)) return;
    await patchThreat({ tags: [...current, tag] }, 'Tag added');
  };
  const removeTag = async (tag: string) => {
    const current: string[] = threat?.tags ?? [];
    await patchThreat({ tags: current.filter((t) => t !== tag) }, 'Tag removed');
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
  // Prefer the stored 0-100 composite score; fall back to the legacy 0-10 heuristic (scaled).
  const riskScore100 =
    typeof threat?.riskScore === 'number'
      ? threat.riskScore
      : Math.round(computeRiskScore({ cvssScore: threat?.cvssScore, severity: threat?.severity, source: threat?.source }) * 10);
  const mitreLabels = describeMitreIds(threat?.mitreAttackIds ?? []);

  const overdue = isOverdue(threat?.dueDate, threat?.status);

  return (
    <div className="p-6 space-y-6 max-w-[1200px] mx-auto">
      <FadeIn>
        <div className="flex items-start gap-4">
          <Link href="/threats">
            <Button variant="ghost" size="icon-sm"><ArrowLeft className="w-4 h-4" /></Button>
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <TypeIcon className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm font-mono text-primary">{threat?.threatId ?? ''}</span>
              <Badge variant="outline" className={`text-[10px] ${severityBadge[threat?.severity] ?? ''}`}>{threat?.severity ?? ''}</Badge>
              <Badge variant="outline" className={`text-[10px] ${statusBadgeClass(threat?.status)}`}>{statusLabel(threat?.status)}</Badge>
              <Badge variant="outline" className={`text-[10px] font-mono gap-1 ${riskScore100BadgeClass(riskScore100)}`} title="ThreatPulse composite risk score (0-100)">
                <Shield className="w-3 h-3" /> Risk {Math.round(riskScore100)} · {riskScore100Label(riskScore100)}
              </Badge>
              {threat?.isKev && (
                <Badge variant="outline" className="text-[10px] gap-1 bg-red-500/15 text-red-500 border-red-500/30" title="CISA Known Exploited Vulnerability">
                  <Flame className="w-3 h-3" /> KEV — Actively Exploited
                </Badge>
              )}
              {threat?.exploitAvailable && (
                <Badge variant="outline" className="text-[10px] gap-1 bg-orange-500/15 text-orange-500 border-orange-500/30" title="Public exploit available">
                  <Crosshair className="w-3 h-3" /> Exploit Available
                </Badge>
              )}
              {overdue && (
                <Badge variant="outline" className="text-[10px] gap-1 bg-red-500/10 text-red-400 border-red-500/20">
                  <CalendarClock className="w-3 h-3" /> Overdue
                </Badge>
              )}
            </div>
            <h1 className="text-xl font-display font-bold tracking-tight mt-1">{threat?.title ?? 'Untitled'}</h1>
            <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1.5">
                <UserPlus className="w-3.5 h-3.5" />
                {threat?.assignedTo ? analystLabel(threat.assignedTo) : 'Unassigned'}
              </span>
              {threat?.dueDate && (
                <span className={`flex items-center gap-1.5 ${overdue ? 'text-red-400' : ''}`}>
                  <CalendarClock className="w-3.5 h-3.5" /> Due {fmtDate(threat.dueDate)}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canManage ? (
              <Select value={threat?.status ?? 'NEW'} onValueChange={updateStatus}>
                <SelectTrigger className="w-[170px] h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {THREAT_STATUS_ORDER.map((s) => (
                    <SelectItem key={s} value={s}>{statusLabel(s)}</SelectItem>
                  ))}
                  {threat?.status && !THREAT_STATUS_ORDER.includes(threat.status) && (
                    <SelectItem value={threat.status}>{statusLabel(threat.status)}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            ) : (
              <Badge variant="outline" className={`text-xs ${statusBadgeClass(threat?.status)}`}>{statusLabel(threat?.status)}</Badge>
            )}
            {(user?.role === 'ADMIN' || user?.role === 'SUPERADMIN' || user?.role === 'PARENT_ADMIN') && (
              <Button variant="destructive" size="sm" onClick={deleteThreat} className="gap-1">
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>
      </FadeIn>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <FadeIn delay={0.05}>
            <Card className="border-border/50">
              <CardHeader className="pb-3"><CardTitle className="text-sm">Description</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{threat?.description ?? 'No description available.'}</p>
              </CardContent>
            </Card>
          </FadeIn>

          <NotesSection
            threatId={id}
            notes={threat?.notes ?? []}
            canManage={canManage}
            currentUserId={user?.id}
            isAdmin={user?.role === 'ADMIN' || user?.role === 'SUPERADMIN' || user?.role === 'PARENT_ADMIN'}
            onChange={fetchThreat}
          />
        </div>

        <div className="space-y-4">
          <FadeIn delay={0.1}>
            <Card className="border-border/50">
              <CardHeader className="pb-3"><CardTitle className="text-sm">Details</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {threat?.cvssScore != null && (
                  <DetailRow icon={Shield} label="CVSS Score" value={String(threat.cvssScore)} />
                )}
                {typeof threat?.epssScore === 'number' && (
                  <DetailRow
                    icon={Flame}
                    label="EPSS"
                    value={`${(threat.epssScore * 100).toFixed(1)}% prob${
                      typeof threat?.epssPercentile === 'number'
                        ? ` · ${(threat.epssPercentile * 100).toFixed(0)}th pct`
                        : ''
                    }`}
                  />
                )}
                {threat?.source && <DetailRow icon={Globe} label="Source" value={threat.source} />}
                {threat?.affectedAssets && <DetailRow icon={Server} label="Affected Assets" value={threat.affectedAssets} />}
                {threat?.dateAdded && <DetailRow icon={Calendar} label="Date Added" value={new Date(threat.dateAdded).toLocaleDateString()} />}
                {threat?.mitreTactic && <DetailRow icon={Activity} label="MITRE Tactic" value={threat.mitreTactic} />}
                {threat?.mitreTechnique && <DetailRow icon={Activity} label="MITRE Technique" value={threat.mitreTechnique} />}
                {mitreLabels.length > 0 && (
                  <div className="flex items-start gap-2 text-sm">
                    <Activity className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">MITRE ATT&CK</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {mitreLabels.map((m) => (
                          <a
                            key={m.id}
                            href={`https://attack.mitre.org/techniques/${m.id.replace('.', '/')}/`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={m.name}
                          >
                            <Badge variant="outline" className="text-[9px] font-mono bg-muted/40 hover:bg-muted/70 transition-colors">
                              {m.id}
                            </Badge>
                          </a>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </FadeIn>

          <FadeIn delay={0.12}>
            <WorkflowCard
              threat={threat}
              canManage={canManage}
              onAssign={assignTo}
              onDueDate={updateDueDate}
              onAddTag={addTag}
              onRemoveTag={removeTag}
            />
          </FadeIn>

          <FadeIn delay={0.14}>
            <StatusTimeline history={threat?.statusHistory ?? []} />
          </FadeIn>
        </div>
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

function WorkflowCard({
  threat,
  canManage,
  onAssign,
  onDueDate,
  onAddTag,
  onRemoveTag,
}: {
  threat: any;
  canManage: boolean;
  onAssign: (id: string | null) => void;
  onDueDate: (iso: string | null) => void;
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
}) {
  const [tagInput, setTagInput] = useState('');
  const [calOpen, setCalOpen] = useState(false);
  const tags: string[] = threat?.tags ?? [];
  const overdue = isOverdue(threat?.dueDate, threat?.status);

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3"><CardTitle className="text-sm">Workflow</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {/* Assignee */}
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">Assignee</p>
          {canManage ? (
            <AnalystSelect
              value={threat?.assignedToId ?? null}
              onChange={onAssign}
              className="w-full h-9 text-sm"
            />
          ) : (
            <div className="flex items-center gap-2 text-sm">
              <Avatar className="w-6 h-6 text-[10px]"><AvatarFallback>{analystInitials(threat?.assignedTo)}</AvatarFallback></Avatar>
              {threat?.assignedTo ? analystLabel(threat.assignedTo) : 'Unassigned'}
            </div>
          )}
        </div>

        {/* Due date */}
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">Due Date</p>
          {canManage ? (
            <div className="flex items-center gap-2">
              <Popover open={calOpen} onOpenChange={setCalOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={`h-9 flex-1 justify-start gap-2 text-sm font-normal ${overdue ? 'border-red-500/40 text-red-400' : ''}`}>
                    <CalendarClock className="w-3.5 h-3.5" />
                    {threat?.dueDate ? fmtDate(threat.dueDate) : 'Set due date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComp
                    mode="single"
                    selected={threat?.dueDate ? new Date(threat.dueDate) : undefined}
                    onSelect={(d: Date | undefined) => {
                      setCalOpen(false);
                      onDueDate(d ? d.toISOString() : null);
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              {threat?.dueDate && (
                <Button variant="ghost" size="icon-sm" onClick={() => onDueDate(null)}><X className="w-3.5 h-3.5" /></Button>
              )}
            </div>
          ) : (
            <p className={`text-sm ${overdue ? 'text-red-400' : ''}`}>{threat?.dueDate ? fmtDate(threat.dueDate) : '—'}</p>
          )}
        </div>

        {/* Tags */}
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1"><Tag className="w-3 h-3" /> Tags</p>
          <div className="flex flex-wrap gap-1.5">
            {tags.length === 0 && <span className="text-xs text-muted-foreground">No tags</span>}
            {tags.map((t) => (
              <Badge key={t} variant="outline" className="text-[10px] gap-1 bg-muted/40">
                {t}
                {canManage && (
                  <button onClick={() => onRemoveTag(t)} className="hover:text-red-400"><X className="w-2.5 h-2.5" /></button>
                )}
              </Badge>
            ))}
          </div>
          {canManage && (
            <div className="flex items-center gap-2 mt-2">
              <Input
                value={tagInput}
                onChange={(e: any) => setTagInput(e.target.value)}
                onKeyDown={(e: any) => {
                  if (e.key === 'Enter') { e.preventDefault(); onAddTag(tagInput); setTagInput(''); }
                }}
                placeholder="Add tag…"
                className="h-8 text-sm"
              />
              <Button variant="outline" size="icon-sm" onClick={() => { onAddTag(tagInput); setTagInput(''); }}><Plus className="w-3.5 h-3.5" /></Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function StatusTimeline({ history }: { history: ThreatStatusHistoryItem[] }) {
  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2"><History className="w-4 h-4 text-primary" /> Status History</CardTitle>
      </CardHeader>
      <CardContent>
        {(history?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-3">No status changes recorded yet.</p>
        ) : (
          <div className="space-y-3">
            {history.map((h) => (
              <div key={h.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="w-2 h-2 rounded-full bg-primary mt-1.5" />
                  <div className="w-px flex-1 bg-border/60" />
                </div>
                <div className="flex-1 pb-1">
                  <div className="flex items-center gap-1.5 flex-wrap text-xs">
                    <Badge variant="outline" className={`text-[10px] ${statusBadgeClass(h.fromStatus)}`}>{statusLabel(h.fromStatus)}</Badge>
                    <span className="text-muted-foreground">→</span>
                    <Badge variant="outline" className={`text-[10px] ${statusBadgeClass(h.toStatus)}`}>{statusLabel(h.toStatus)}</Badge>
                  </div>
                  {h.note && <p className="text-xs text-muted-foreground mt-1">{h.note}</p>}
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {analystLabel(h.changedBy)} · {fmtDateTime(h.createdAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function NotesSection({
  threatId,
  notes,
  canManage,
  currentUserId,
  isAdmin,
  onChange,
}: {
  threatId: string;
  notes: ThreatNoteItem[];
  canManage: boolean;
  currentUserId?: string;
  isAdmin: boolean;
  onChange: () => void;
}) {
  const [content, setContent] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const addNote = async () => {
    const text = content.trim();
    if (!text) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/threats/${threatId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text, isInternal }),
      });
      if (res.ok) {
        setContent(''); setIsInternal(false);
        toast.success('Note added');
        onChange();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data?.error ?? 'Failed to add note');
      }
    } catch { toast.error('Failed to add note'); }
    finally { setSubmitting(false); }
  };

  const deleteNote = async (noteId: string) => {
    try {
      const res = await fetch(`/api/threats/${threatId}/notes/${noteId}`, { method: 'DELETE' });
      if (res.ok) { toast.success('Note deleted'); onChange(); }
      else { const data = await res.json().catch(() => ({})); toast.error(data?.error ?? 'Failed to delete'); }
    } catch { toast.error('Failed to delete note'); }
  };

  return (
    <FadeIn delay={0.08}>
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-primary" /> Analyst Notes
            <span className="text-xs text-muted-foreground font-normal">({notes?.length ?? 0})</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {canManage && (
            <div className="space-y-2">
              <Textarea
                value={content}
                onChange={(e: any) => setContent(e.target.value)}
                placeholder="Add an investigation note…"
                className="min-h-[80px] text-sm"
              />
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                  <Checkbox checked={isInternal} onCheckedChange={(v: any) => setIsInternal(Boolean(v))} />
                  <Lock className="w-3 h-3" /> Internal (hidden from viewers)
                </label>
                <Button size="sm" onClick={addNote} loading={submitting} className="gap-1.5">
                  <Send className="w-3.5 h-3.5" /> Add Note
                </Button>
              </div>
            </div>
          )}

          {(notes?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-3">No notes yet.</p>
          ) : (
            <div className="space-y-3">
              {notes.map((n) => (
                <div key={n.id} className="rounded-lg border border-border/50 bg-muted/20 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar className="w-6 h-6 text-[10px]"><AvatarFallback>{analystInitials(n.author)}</AvatarFallback></Avatar>
                      <span className="text-sm font-medium truncate">{analystLabel(n.author)}</span>
                      {n.isInternal && (
                        <Badge variant="outline" className="text-[9px] gap-1 bg-amber-500/10 text-amber-400 border-amber-500/20"><Lock className="w-2.5 h-2.5" /> Internal</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-muted-foreground">{fmtDateTime(n.createdAt)}</span>
                      {(isAdmin || n.authorId === currentUserId) && (
                        <Button variant="ghost" size="icon-sm" onClick={() => deleteNote(n.id)}><Trash2 className="w-3.5 h-3.5 text-red-500" /></Button>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap leading-relaxed">{n.content}</p>
                </div>
              ))}
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
