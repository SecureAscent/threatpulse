'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import {
  Search, Filter, Ticket, Plus, X, ChevronRight, ExternalLink, ShieldAlert,
  FileText, CircleDot, Clock, CheckCircle2, Flame, RefreshCw, Send,
} from 'lucide-react';
import { FadeIn } from '@/components/ui/animate';
import { toast } from 'sonner';
import type { ThreatItem } from '@/lib/types';
import CreateTicketModal from './create-ticket-modal';

interface JiraTicket {
  id: string;
  jiraKey?: string | null;
  title: string;
  description: string;
  priority: string;
  status: string;
  affectedPackage?: string | null;
  affectedProduct?: string | null;
  productOwner?: string | null;
  cvssScore?: number | null;
  cveId?: string | null;
  remediationSteps?: string | null;
  notes?: string | null;
  createdBy: string;
  createdAt: string;
  threat?: { id: string; threatId: string; title: string; severity: string; cvssScore?: number | null; source?: string | null } | null;
}

const priorityBadge: Record<string, string> = {
  Critical: 'bg-red-500/10 text-red-500 border-red-500/20',
  High: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  Medium: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  Low: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
};

const statusBadge: Record<string, string> = {
  DRAFT: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  CREATED: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  IN_PROGRESS: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  RESOLVED: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  CLOSED: 'bg-muted text-muted-foreground border-border',
};

const SOURCES = ['NVD', 'CISA KEV', 'VirusTotal', 'MITRE', 'Vendor Advisory', 'Internal'];

export default function JiraTicketsContent() {
  const [tickets, setTickets] = useState<JiraTicket[]>([]);
  const [threats, setThreats] = useState<ThreatItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<JiraTicket | null>(null);
  const [jiraEnabled, setJiraEnabled] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [pushing, setPushing] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [cveSearch, setCveSearch] = useState('');
  const [cvssRange, setCvssRange] = useState<number[]>([0, 10]);
  const [sourceFilter, setSourceFilter] = useState('all');
  const [kevOnly, setKevOnly] = useState(false);
  const [productFilter, setProductFilter] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(true);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/jira-tickets');
      if (res.ok) {
        const data = await res.json();
        setTickets(data?.tickets ?? []);
      }
    } catch (err) {
      console.error('Fetch tickets error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchThreats = useCallback(async () => {
    try {
      const res = await fetch('/api/threats');
      if (res.ok) {
        const data = await res.json();
        setThreats(data?.threats ?? []);
      }
    } catch { /* ignore */ }
  }, []);

  const checkJiraConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/integrations');
      if (res.ok) {
        const data = await res.json();
        const jiraCfg = data?.configs?.find((c: any) => c.integrationId === 'jira');
        setJiraEnabled(!!jiraCfg?.enabled);
      }
    } catch { /* ignore */ }
  }, []);

  const syncFromJira = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/jira-tickets/sync', { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        toast.success(data.message || 'Sync complete');
        fetchTickets();
      } else {
        toast.error(data.error || 'Sync failed');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to sync from Jira');
    } finally {
      setSyncing(false);
    }
  };

  const pushTicket = async (ticketId: string) => {
    setPushing(ticketId);
    try {
      const res = await fetch(`/api/jira-tickets/${ticketId}/push`, { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        toast.success(`Pushed to Jira: ${data.jiraKey}`);
        fetchTickets();
      } else {
        toast.error(data.error || 'Failed to push');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to push to Jira');
    } finally {
      setPushing(null);
    }
  };

  useEffect(() => { fetchTickets(); fetchThreats(); checkJiraConfig(); }, [fetchTickets, fetchThreats, checkJiraConfig]);

  const isKev = (t: JiraTicket) => {
    const s = (t.threat?.source || '').toLowerCase();
    return s.includes('kev') || s.includes('known exploited');
  };

  const filtered = useMemo(() => {
    return (tickets ?? []).filter((t) => {
      if (search) {
        const q = search.toLowerCase();
        const hay = `${t.title} ${t.cveId ?? ''} ${t.jiraKey ?? ''} ${t.affectedProduct ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (cveSearch && !((t.cveId ?? '').toLowerCase().includes(cveSearch.toLowerCase()))) return false;
      const cvss = t.cvssScore ?? t.threat?.cvssScore ?? 0;
      if (cvss < cvssRange[0] || cvss > cvssRange[1]) return false;
      if (sourceFilter !== 'all') {
        const src = (t.threat?.source || '').toLowerCase();
        if (!src.includes(sourceFilter.toLowerCase())) return false;
      }
      if (kevOnly && !isKev(t)) return false;
      if (productFilter && !((t.affectedProduct ?? '').toLowerCase().includes(productFilter.toLowerCase()))) return false;
      if (ownerFilter && !((t.productOwner ?? '').toLowerCase().includes(ownerFilter.toLowerCase()))) return false;
      if (dateFrom && new Date(t.createdAt) < new Date(dateFrom)) return false;
      if (dateTo && new Date(t.createdAt) > new Date(dateTo + 'T23:59:59')) return false;
      return true;
    });
  }, [tickets, search, priorityFilter, statusFilter, cveSearch, cvssRange, sourceFilter, kevOnly, productFilter, ownerFilter, dateFrom, dateTo]);

  const stats = useMemo(() => {
    const total = tickets.length;
    const drafts = tickets.filter((t) => t.status === 'DRAFT').length;
    const critical = tickets.filter((t) => t.priority === 'Critical').length;
    const open = tickets.filter((t) => t.status !== 'RESOLVED' && t.status !== 'CLOSED').length;
    return { total, drafts, critical, open };
  }, [tickets]);

  const clearFilters = () => {
    setSearch(''); setPriorityFilter('all'); setStatusFilter('all'); setCveSearch('');
    setCvssRange([0, 10]); setSourceFilter('all'); setKevOnly(false); setProductFilter('');
    setOwnerFilter(''); setDateFrom(''); setDateTo('');
  };

  const hasFilters = search || priorityFilter !== 'all' || statusFilter !== 'all' || cveSearch ||
    cvssRange[0] !== 0 || cvssRange[1] !== 10 || sourceFilter !== 'all' || kevOnly ||
    productFilter || ownerFilter || dateFrom || dateTo;

  const deleteTicket = async (id: string) => {
    try {
      const res = await fetch(`/api/jira-tickets/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Ticket deleted');
        setSelected(null);
        fetchTickets();
      } else {
        toast.error('Failed to delete ticket');
      }
    } catch {
      toast.error('Failed to delete ticket');
    }
  };

  const statCards = [
    { label: 'Total Tickets', value: stats.total, icon: Ticket, color: 'text-primary' },
    { label: 'Open', value: stats.open, icon: CircleDot, color: 'text-blue-500' },
    { label: 'Drafts', value: stats.drafts, icon: FileText, color: 'text-slate-400' },
    { label: 'Critical', value: stats.critical, icon: Flame, color: 'text-red-500' },
  ];

  return (
    <div className="p-6 space-y-6 max-w-[1300px] mx-auto">
      <FadeIn>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold tracking-tight flex items-center gap-2">
              <Ticket className="w-6 h-6 text-primary" /> Jira Tickets
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Create and manage remediation tickets from threat intelligence</p>
          </div>
          <div className="flex items-center gap-2">
            {jiraEnabled && (
              <Button size="sm" variant="outline" className="gap-1.5" onClick={syncFromJira} disabled={syncing}>
                <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Syncing...' : 'Sync from Jira'}
              </Button>
            )}
            <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
              <Plus className="w-4 h-4" /> Create Ticket
            </Button>
          </div>
        </div>
      </FadeIn>

      {/* Jira not connected banner */}
      {!jiraEnabled && (
        <FadeIn delay={0.03}>
          <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
            <ShieldAlert className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
            <div className="text-sm">
              <span className="font-semibold text-amber-600 dark:text-amber-400">Jira integration not configured.</span>{' '}
              <span className="text-amber-600/90 dark:text-amber-400/90">
                Tickets created here are stored as drafts in ThreatPulse. Configure Jira in
                Settings → Integrations to push drafts to your Jira project automatically.
              </span>
            </div>
          </div>
        </FadeIn>
      )}

      {/* Stats */}
      <FadeIn delay={0.05}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {statCards.map((s) => (
            <Card key={s.label} className="border-border/50">
              <CardContent className="pt-4 pb-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className="text-2xl font-bold mt-1">{s.value}</p>
                </div>
                <s.icon className={`w-8 h-8 ${s.color} opacity-70`} />
              </CardContent>
            </Card>
          ))}
        </div>
      </FadeIn>

      {/* Filters */}
      <FadeIn delay={0.08}>
        <Card className="border-border/50">
          <CardContent className="pt-4 pb-4 space-y-4">
            <div className="flex items-center justify-between">
              <button onClick={() => setShowFilters((v) => !v)} className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors">
                <Filter className="w-4 h-4" /> Filters
              </button>
              {hasFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 text-xs">
                  <X className="w-3 h-3" /> Clear all
                </Button>
              )}
            </div>

            {showFilters && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input placeholder="Search tickets..." value={search} onChange={(e: any) => setSearch(e.target.value)} className="pl-10 h-9" />
                  </div>
                  <Input placeholder="CVE ID (e.g. CVE-2024-1234)" value={cveSearch} onChange={(e: any) => setCveSearch(e.target.value)} className="h-9" />
                  <div className="grid grid-cols-2 gap-3">
                    <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="Priority" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Priority</SelectItem>
                        <SelectItem value="Critical">Critical</SelectItem>
                        <SelectItem value="High">High</SelectItem>
                        <SelectItem value="Medium">Medium</SelectItem>
                        <SelectItem value="Low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="Status" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="DRAFT">Draft</SelectItem>
                        <SelectItem value="CREATED">Created</SelectItem>
                        <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                        <SelectItem value="RESOLVED">Resolved</SelectItem>
                        <SelectItem value="CLOSED">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Input placeholder="Affected product" value={productFilter} onChange={(e: any) => setProductFilter(e.target.value)} className="h-9" />
                  <Input placeholder="Product owner" value={ownerFilter} onChange={(e: any) => setOwnerFilter(e.target.value)} className="h-9" />
                  <Select value={sourceFilter} onValueChange={setSourceFilter}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Source" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Sources</SelectItem>
                      {SOURCES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                  <div className="space-y-2">
                    <Label className="text-xs flex items-center justify-between">
                      <span>CVSS Range</span>
                      <span className="font-mono text-primary">{cvssRange[0].toFixed(1)} – {cvssRange[1].toFixed(1)}</span>
                    </Label>
                    <Slider min={0} max={10} step={0.1} value={cvssRange} onValueChange={setCvssRange} className="py-1" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">From</Label>
                      <Input type="date" value={dateFrom} onChange={(e: any) => setDateFrom(e.target.value)} className="h-9 text-xs" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">To</Label>
                      <Input type="date" value={dateTo} onChange={(e: any) => setDateTo(e.target.value)} className="h-9 text-xs" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-4">
                    <Switch id="kev" checked={kevOnly} onCheckedChange={setKevOnly} />
                    <Label htmlFor="kev" className="text-xs cursor-pointer flex items-center gap-1">
                      <Flame className="w-3.5 h-3.5 text-red-500" /> Known Exploited (KEV) only
                    </Label>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </FadeIn>

      {/* Table */}
      <FadeIn delay={0.1}>
        <Card className="border-border/50">
          <CardContent className="p-0">
            {loading ? (
              <div className="space-y-2 p-6">
                {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-12 bg-muted animate-pulse rounded" />)}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16">
                <Ticket className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No tickets found</p>
                <Button size="sm" variant="outline" className="mt-4 gap-1.5" onClick={() => setCreateOpen(true)}>
                  <Plus className="w-4 h-4" /> Create your first ticket
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[110px]">Key</TableHead>
                      <TableHead>Summary</TableHead>
                      <TableHead className="w-[120px]">CVE</TableHead>
                      <TableHead className="w-[90px]">Priority</TableHead>
                      <TableHead className="w-[80px]">CVSS</TableHead>
                      <TableHead className="w-[110px]">Status</TableHead>
                      <TableHead className="w-[140px]">Owner</TableHead>
                      <TableHead className="w-[100px]">Created</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((t) => (
                      <TableRow key={t.id} className="hover:bg-muted/30">
                        <TableCell className="font-mono text-xs">
                          {t.jiraKey ? <span className="text-primary">{t.jiraKey}</span> : <Badge variant="outline" className="text-[10px] bg-slate-500/10 text-slate-400 border-slate-500/20">DRAFT</Badge>}
                        </TableCell>
                        <TableCell className="font-medium text-sm max-w-[280px] truncate cursor-pointer" onClick={() => setSelected(t)}>{t.title}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{t.cveId || '—'}</TableCell>
                        <TableCell><Badge variant="outline" className={`text-[10px] ${priorityBadge[t.priority] ?? ''}`}>{t.priority}</Badge></TableCell>
                        <TableCell className="font-mono text-xs">{(t.cvssScore ?? t.threat?.cvssScore) != null ? (t.cvssScore ?? t.threat?.cvssScore)!.toFixed(1) : '—'}</TableCell>
                        <TableCell><Badge variant="outline" className={`text-[10px] ${statusBadge[t.status] ?? ''}`}>{t.status.replace('_', ' ')}</Badge></TableCell>
                        <TableCell className="text-xs text-muted-foreground truncate max-w-[140px]">{t.productOwner || '—'}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{new Date(t.createdAt).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            {t.status === 'DRAFT' && jiraEnabled && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 gap-1 text-xs"
                                disabled={pushing === t.id}
                                onClick={(e) => { e.stopPropagation(); pushTicket(t.id); }}
                              >
                                {pushing === t.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                                {pushing === t.id ? 'Pushing...' : 'Push'}
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setSelected(t)}>
                              <ChevronRight className="w-4 h-4 text-muted-foreground" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
        <p className="text-xs text-muted-foreground text-right mt-2">{filtered.length} ticket{filtered.length !== 1 ? 's' : ''} shown</p>
      </FadeIn>

      <CreateTicketModal open={createOpen} onOpenChange={setCreateOpen} threats={threats} onSuccess={fetchTickets} />

      {/* Detail drawer */}
      <Sheet open={!!selected} onOpenChange={(o) => { if (!o) setSelected(null); }}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2 pr-6">
                  <Ticket className="w-5 h-5 text-primary shrink-0" />
                  <span className="text-base">{selected.title}</span>
                </SheetTitle>
                <SheetDescription>
                  {selected.jiraKey ? `Jira key: ${selected.jiraKey}` : 'Draft ticket — not yet created in Jira'}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-5">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className={`${priorityBadge[selected.priority] ?? ''}`}>{selected.priority}</Badge>
                  <Badge variant="outline" className={`${statusBadge[selected.status] ?? ''}`}>{selected.status.replace('_', ' ')}</Badge>
                  {isKev(selected) && <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20 gap-1"><Flame className="w-3 h-3" /> KEV</Badge>}
                </div>

                <DetailField label="CVE ID" value={selected.cveId} mono />
                <DetailField label="CVSS Score" value={(selected.cvssScore ?? selected.threat?.cvssScore) != null ? String(selected.cvssScore ?? selected.threat?.cvssScore) : null} mono />
                <DetailField label="Affected Product" value={selected.affectedProduct} />
                <DetailField label="Affected Package" value={selected.affectedPackage} />
                <DetailField label="Product Owner" value={selected.productOwner} />

                {selected.threat && (
                  <div className="rounded-lg border border-border/50 bg-muted/30 p-3">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Linked Threat</p>
                    <a href={`/threats/${selected.threat.id}`} className="text-sm text-primary hover:underline flex items-center gap-1">
                      <span className="font-mono text-xs">{selected.threat.threatId}</span> — {selected.threat.title}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}

                <DetailBlock label="Description" value={selected.description} />
                <DetailBlock label="Remediation Steps" value={selected.remediationSteps} />
                <DetailBlock label="Notes" value={selected.notes} />

                <div className="text-xs text-muted-foreground pt-2 border-t border-border/50">
                  Created by {selected.createdBy} on {new Date(selected.createdAt).toLocaleString()}
                </div>

                <div className="flex gap-2 pt-2">
                  <Button variant="destructive" size="sm" onClick={() => deleteTicket(selected.id)}>Delete</Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function DetailField({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span className={`text-sm text-right ${mono ? 'font-mono' : ''}`}>{value || '—'}</span>
    </div>
  );
}

function DetailBlock({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="space-y-1">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-sm whitespace-pre-wrap leading-relaxed">{value}</p>
    </div>
  );
}
