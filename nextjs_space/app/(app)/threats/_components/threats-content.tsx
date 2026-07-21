'use client';
import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComp } from '@/components/ui/calendar';
import { Search, AlertTriangle, Bug, Crosshair, Activity, ChevronRight, X, Plus, ArrowUpDown, Bookmark, BookmarkPlus, Trash2, CalendarClock, Users } from 'lucide-react';
import { FadeIn } from '@/components/ui/animate';
import type { ThreatItem, SavedFilterItem } from '@/lib/types';
import { computeRiskScore, riskScore100BadgeClass, riskScore100Label } from '@/lib/risk-score';
import { toast } from 'sonner';
import Link from 'next/link';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { THREAT_STATUS_ORDER, statusBadgeClass, statusLabel, isOverdue } from '@/lib/threat-status';
import { useAnalysts, analystLabel, analystInitials } from '@/components/analyst-select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

const severityBadge: Record<string, string> = {
  CRITICAL: 'bg-red-500/10 text-red-500 border-red-500/20',
  HIGH: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  MEDIUM: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  LOW: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
};

const typeIcons: Record<string, any> = { CVE: Bug, IOC: Crosshair, TTP: Activity };

// Effective 0-100 risk: prefer the stored composite score from the intelligence
// engine; fall back to the legacy 0-10 heuristic (scaled) for un-enriched rows.
function effectiveRisk(t: Partial<ThreatItem>): number {
  if (typeof t?.riskScore === 'number') return t.riskScore;
  return Math.round(computeRiskScore({ cvssScore: t?.cvssScore, severity: t?.severity, source: t?.source }) * 10);
}

type QuickFilter = 'all' | 'action_required' | 'mine' | 'unassigned' | 'overdue';

const QUICK_FILTERS: { value: QuickFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'action_required', label: 'Action Required' },
  { value: 'mine', label: 'Assigned to Me' },
  { value: 'unassigned', label: 'Unassigned' },
  { value: 'overdue', label: 'Overdue' },
];

function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return '—';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ThreatsContent() {
  const { data: session } = useSession() || {};
  const user = session?.user as any;
  const canManage = Boolean(user?.role) && user?.role !== 'VIEWER';
  const analysts = useAnalysts();
  const [threats, setThreats] = useState<ThreatItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all');
  const [addOpen, setAddOpen] = useState(false);
  const [sortByRisk, setSortByRisk] = useState<'none' | 'desc' | 'asc'>('none');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [savedFilters, setSavedFilters] = useState<SavedFilterItem[]>([]);
  const [saveOpen, setSaveOpen] = useState(false);

  const toggleRiskSort = () => setSortByRisk((prev) => (prev === 'none' ? 'desc' : prev === 'desc' ? 'asc' : 'none'));

  const fetchSavedFilters = useCallback(async () => {
    try {
      const res = await fetch('/api/saved-filters');
      if (res.ok) {
        const data = await res.json();
        setSavedFilters(data?.savedFilters ?? []);
      }
    } catch { /* ignore */ }
  }, []);

  const fetchThreats = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (typeFilter !== 'all') params.set('type', typeFilter);
      if (severityFilter !== 'all') params.set('severity', severityFilter);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (search) params.set('search', search);
      if (quickFilter === 'action_required') params.set('status', 'ACTION_REQUIRED');
      if (quickFilter === 'mine') params.set('assignedTo', 'me');
      if (quickFilter === 'unassigned') params.set('assignedTo', 'unassigned');
      const res = await fetch(`/api/threats?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setThreats(data?.threats ?? []);
      }
    } catch (err: any) {
      console.error('Fetch threats error:', err);
    } finally {
      setLoading(false);
    }
  }, [typeFilter, severityFilter, statusFilter, search, quickFilter]);

  useEffect(() => { fetchThreats(); }, [fetchThreats]);
  useEffect(() => { fetchSavedFilters(); }, [fetchSavedFilters]);
  useEffect(() => { setSelected(new Set()); }, [typeFilter, severityFilter, statusFilter, search, quickFilter]);

  const displayedThreats = (() => {
    let list = [...(threats ?? [])];
    if (quickFilter === 'overdue') list = list.filter((t) => isOverdue(t?.dueDate, t?.status));
    if (sortByRisk === 'none') return list;
    return list.sort((a, b) => {
      const ra = effectiveRisk(a);
      const rb = effectiveRisk(b);
      return sortByRisk === 'desc' ? rb - ra : ra - rb;
    });
  })();

  const clearFilters = () => {
    setTypeFilter('all');
    setSeverityFilter('all');
    setStatusFilter('all');
    setSearch('');
    setQuickFilter('all');
  };

  const hasFilters = typeFilter !== 'all' || severityFilter !== 'all' || statusFilter !== 'all' || search !== '' || quickFilter !== 'all';

  const applySavedFilter = (f: SavedFilterItem) => {
    const fl = f.filters ?? {};
    setTypeFilter(fl.type ?? 'all');
    setSeverityFilter(fl.severity ?? 'all');
    setStatusFilter(fl.status ?? 'all');
    setSearch(fl.search ?? '');
    setQuickFilter(fl.quickFilter ?? 'all');
    toast.success(`Applied "${f.name}"`);
  };

  const deleteSavedFilter = async (id: string) => {
    try {
      const res = await fetch(`/api/saved-filters/${id}`, { method: 'DELETE' });
      if (res.ok) { toast.success('Filter deleted'); fetchSavedFilters(); }
      else { const d = await res.json().catch(() => ({})); toast.error(d?.error ?? 'Failed to delete'); }
    } catch { toast.error('Failed to delete filter'); }
  };

  // --- selection helpers ---
  const allSelected = displayedThreats.length > 0 && displayedThreats.every((t) => selected.has(t.id));
  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(displayedThreats.map((t) => t.id)));
  };
  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const runBulk = async (action: string, payload: any) => {
    const threatIds = Array.from(selected);
    if (threatIds.length === 0) return;
    try {
      const res = await fetch('/api/threats/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threatIds, action, payload }),
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(`Updated ${data?.updatedCount ?? threatIds.length} threat(s)`);
        setSelected(new Set());
        fetchThreats();
      } else {
        const d = await res.json().catch(() => ({}));
        toast.error(d?.error ?? 'Bulk action failed');
      }
    } catch { toast.error('Bulk action failed'); }
  };

  return (
    <div className="p-6 space-y-6 max-w-[1280px] mx-auto">
      <FadeIn>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold tracking-tight">Threat Intelligence</h1>
            <p className="text-sm text-muted-foreground mt-1">Browse and manage all tracked CVEs, IOCs, and TTPs</p>
          </div>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5"><Plus className="w-4 h-4" />Add Threat</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Add New Threat</DialogTitle></DialogHeader>
              <AddThreatForm onSuccess={() => { setAddOpen(false); fetchThreats(); }} />
            </DialogContent>
          </Dialog>
        </div>
      </FadeIn>

      {/* Quick filters + saved filters */}
      <FadeIn delay={0.03}>
        <div className="flex flex-wrap items-center gap-2">
          {QUICK_FILTERS.map((q) => (
            <button
              key={q.value}
              onClick={() => setQuickFilter(q.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                quickFilter === q.value
                  ? 'bg-primary/15 text-primary border-primary/30'
                  : 'bg-muted/30 text-muted-foreground border-border/50 hover:bg-muted/50'
              }`}
            >
              {q.label}
            </button>
          ))}
          <div className="flex-1" />
          {savedFilters.length > 0 && (
            <Select onValueChange={(id) => { const f = savedFilters.find((x) => x.id === id); if (f) applySavedFilter(f); }}>
              <SelectTrigger className="w-[190px] h-8 text-xs"><Bookmark className="w-3.5 h-3.5 mr-1" /><SelectValue placeholder="Saved filters" /></SelectTrigger>
              <SelectContent>
                {savedFilters.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name}{f.isShared ? ' (shared)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs"><BookmarkPlus className="w-3.5 h-3.5" /> Save filter</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Save current filter</DialogTitle></DialogHeader>
              <SaveFilterForm
                current={{ type: typeFilter, severity: severityFilter, status: statusFilter, search, quickFilter }}
                onSaved={() => { setSaveOpen(false); fetchSavedFilters(); }}
              />
              {savedFilters.length > 0 && (
                <div className="border-t border-border/50 pt-3 mt-1 space-y-1.5 max-h-[200px] overflow-y-auto">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Your saved filters</p>
                  {savedFilters.map((f) => (
                    <div key={f.id} className="flex items-center justify-between text-sm">
                      <button className="hover:text-primary text-left" onClick={() => { applySavedFilter(f); setSaveOpen(false); }}>
                        {f.name}{f.isShared ? ' (shared)' : ''}
                      </button>
                      <Button variant="ghost" size="icon-sm" onClick={() => deleteSavedFilter(f.id)}><Trash2 className="w-3.5 h-3.5 text-red-500" /></Button>
                    </div>
                  ))}
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </FadeIn>

      {/* Filters */}
      <FadeIn delay={0.05}>
        <Card className="border-border/50">
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Search threats..." value={search} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)} className="pl-10 h-9" />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[130px] h-9"><SelectValue placeholder="Type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="CVE">CVE</SelectItem>
                  <SelectItem value="IOC">IOC</SelectItem>
                  <SelectItem value="TTP">TTP</SelectItem>
                </SelectContent>
              </Select>
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger className="w-[140px] h-9"><SelectValue placeholder="Severity" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severity</SelectItem>
                  <SelectItem value="CRITICAL">Critical</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="LOW">Low</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  {THREAT_STATUS_ORDER.map((s) => (
                    <SelectItem key={s} value={s}>{statusLabel(s)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {hasFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 text-xs">
                  <X className="w-3 h-3" /> Clear
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      {/* Bulk toolbar */}
      {canManage && selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <div className="flex-1" />
          <Select onValueChange={(v) => runBulk('status', { status: v })}>
            <SelectTrigger className="w-[150px] h-8 text-xs"><SelectValue placeholder="Set status" /></SelectTrigger>
            <SelectContent>
              {THREAT_STATUS_ORDER.map((s) => <SelectItem key={s} value={s}>{statusLabel(s)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select onValueChange={(v) => runBulk('assign', { assignedToId: v === '__unassigned__' ? null : v })}>
            <SelectTrigger className="w-[160px] h-8 text-xs"><Users className="w-3.5 h-3.5 mr-1" /><SelectValue placeholder="Assign" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__unassigned__">Unassigned</SelectItem>
              {analysts.map((a) => <SelectItem key={a.id} value={a.id}>{analystLabel(a)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs"><CalendarClock className="w-3.5 h-3.5" /> Due date</Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <CalendarComp mode="single" onSelect={(d: Date | undefined) => runBulk('due_date', { dueDate: d ? d.toISOString() : null })} initialFocus />
              <div className="border-t border-border/50 p-2">
                <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => runBulk('due_date', { dueDate: null })}>Clear due date</Button>
              </div>
            </PopoverContent>
          </Popover>
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setSelected(new Set())}>Cancel</Button>
        </div>
      )}

      {/* Table */}
      <FadeIn delay={0.1}>
        <Card className="border-border/50">
          <CardContent className="p-0">
            {loading ? (
              <div className="space-y-2 p-6">
                {[1,2,3,4,5].map((i: number) => <div key={i} className="h-12 bg-muted animate-pulse rounded" />)}
              </div>
            ) : (displayedThreats?.length ?? 0) === 0 ? (
              <div className="text-center py-16">
                <AlertTriangle className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No threats found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {canManage && (
                        <TableHead className="w-[40px]">
                          <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all" />
                        </TableHead>
                      )}
                      <TableHead className="w-[130px]">ID</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead className="w-[80px]">Type</TableHead>
                      <TableHead className="w-[100px]">Severity</TableHead>
                      <TableHead className="w-[110px]">
                        <button
                          type="button"
                          onClick={toggleRiskSort}
                          className="flex items-center gap-1 hover:text-foreground transition-colors"
                          title="ThreatPulse Risk Score"
                        >
                          Risk Score
                          <ArrowUpDown className={`w-3 h-3 ${sortByRisk !== 'none' ? 'text-primary' : 'text-muted-foreground'}`} />
                        </button>
                      </TableHead>
                      <TableHead className="w-[130px]">Status</TableHead>
                      <TableHead className="w-[150px]">Assignee</TableHead>
                      <TableHead className="w-[120px]">Due</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(displayedThreats ?? []).map((threat: ThreatItem) => {
                      const TypeIcon = typeIcons[threat?.type] ?? Bug;
                      const riskScore = effectiveRisk(threat);
                      const overdue = isOverdue(threat?.dueDate, threat?.status);
                      const isSel = selected.has(threat.id);
                      return (
                        <TableRow key={threat?.id} className={`hover:bg-muted/30 ${isSel ? 'bg-primary/5' : ''}`}>
                          {canManage && (
                            <TableCell>
                              <Checkbox checked={isSel} onCheckedChange={() => toggleOne(threat.id)} aria-label="Select row" />
                            </TableCell>
                          )}
                          <TableCell className="font-mono text-xs text-primary">{threat?.threatId ?? ''}</TableCell>
                          <TableCell className="max-w-[280px]">
                            <Link href={`/threats/${threat?.id}`} className="font-medium text-sm hover:text-primary truncate block">{threat?.title ?? ''}</Link>
                            {(threat?.tags?.length ?? 0) > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {threat.tags!.slice(0, 4).map((t) => (
                                  <Badge key={t} variant="outline" className="text-[9px] bg-muted/40">{t}</Badge>
                                ))}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <TypeIcon className="w-3.5 h-3.5 text-muted-foreground" />
                              <span className="text-xs font-mono">{threat?.type ?? ''}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <Badge variant="outline" className={`text-[10px] w-fit ${severityBadge[threat?.severity] ?? ''}`}>
                                {threat?.severity ?? ''}
                              </Badge>
                              {threat?.isKev && (
                                <Badge variant="outline" className="text-[9px] w-fit bg-red-500/15 text-red-500 border-red-500/30 gap-1">
                                  <AlertTriangle className="w-2.5 h-2.5" /> KEV
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-0.5">
                              <Badge variant="outline" className={`text-[10px] font-mono w-fit ${riskScore100BadgeClass(riskScore)}`}>
                                {Math.round(riskScore)}
                                <span className="ml-1 opacity-70">{riskScore100Label(riskScore)}</span>
                              </Badge>
                              {typeof threat?.epssPercentile === 'number' && (
                                <span className="text-[9px] text-muted-foreground font-mono" title="EPSS exploit-prediction percentile">
                                  EPSS {(threat.epssPercentile * 100).toFixed(0)}%
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`text-[10px] ${statusBadgeClass(threat?.status)}`}>
                              {statusLabel(threat?.status)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {threat?.assignedTo ? (
                              <div className="flex items-center gap-1.5">
                                <Avatar className="w-5 h-5 text-[9px]"><AvatarFallback>{analystInitials(threat.assignedTo)}</AvatarFallback></Avatar>
                                <span className="text-xs truncate max-w-[100px]">{analystLabel(threat.assignedTo)}</span>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">Unassigned</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className={`text-xs ${overdue ? 'text-red-400 font-medium' : 'text-muted-foreground'}`}>
                              {threat?.dueDate ? fmtDate(threat.dueDate) : '—'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Link href={`/threats/${threat?.id}`}>
                              <Button variant="ghost" size="icon-sm"><ChevronRight className="w-4 h-4" /></Button>
                            </Link>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
        <p className="text-xs text-muted-foreground text-right mt-2">{displayedThreats?.length ?? 0} threat{(displayedThreats?.length ?? 0) !== 1 ? 's' : ''} found</p>
      </FadeIn>
    </div>
  );
}

function SaveFilterForm({ current, onSaved }: { current: Record<string, any>; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [isShared, setIsShared] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const save = async () => {
    if (!name.trim()) { toast.error('Enter a name'); return; }
    setSubmitting(true);
    try {
      const res = await fetch('/api/saved-filters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), filters: current, isShared }),
      });
      if (res.ok) { toast.success('Filter saved'); setName(''); onSaved(); }
      else { const d = await res.json().catch(() => ({})); toast.error(d?.error ?? 'Failed to save'); }
    } catch { toast.error('Failed to save filter'); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs">Filter name</Label>
        <Input value={name} onChange={(e: any) => setName(e.target.value)} placeholder="e.g. Critical & unassigned" className="h-9 text-sm" />
      </div>
      <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
        <Checkbox checked={isShared} onCheckedChange={(v: any) => setIsShared(Boolean(v))} />
        Share with my organization
      </label>
      <Button onClick={save} loading={submitting} className="w-full">Save filter</Button>
    </div>
  );
}

function AddThreatForm({ onSuccess }: { onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    threatId: '', title: '', type: 'CVE', severity: 'MEDIUM', status: 'NEW',
    description: '', affectedAssets: '', source: '', indicators: '',
    mitreTactic: '', mitreTechnique: '', cvssScore: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData?.threatId || !formData?.title) { toast.error('Threat ID and Title are required'); return; }
    setSubmitting(true);
    try {
      const res = await fetch('/api/threats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        toast.success('Threat added successfully');
        onSuccess?.();
      } else {
        const data = await res.json();
        toast.error(data?.error ?? 'Failed to add threat');
      }
    } catch {
      toast.error('Failed');
    } finally {
      setSubmitting(false);
    }
  };

  const update = (field: string, value: string) => setFormData((prev: any) => ({ ...(prev ?? {}), [field]: value }));

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Threat ID *</Label>
          <Input placeholder="CVE-2024-XXXX" value={formData?.threatId ?? ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => update('threatId', e.target.value)} className="h-8 text-sm" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Title *</Label>
          <Input placeholder="Vulnerability name" value={formData?.title ?? ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => update('title', e.target.value)} className="h-8 text-sm" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Type</Label>
          <Select value={formData?.type ?? 'CVE'} onValueChange={(v: string) => update('type', v)}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="CVE">CVE</SelectItem><SelectItem value="IOC">IOC</SelectItem><SelectItem value="TTP">TTP</SelectItem></SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Severity</Label>
          <Select value={formData?.severity ?? 'MEDIUM'} onValueChange={(v: string) => update('severity', v)}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="CRITICAL">Critical</SelectItem><SelectItem value="HIGH">High</SelectItem><SelectItem value="MEDIUM">Medium</SelectItem><SelectItem value="LOW">Low</SelectItem></SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Status</Label>
          <Select value={formData?.status ?? 'NEW'} onValueChange={(v: string) => update('status', v)}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {THREAT_STATUS_ORDER.map((s) => <SelectItem key={s} value={s}>{statusLabel(s)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Description</Label>
        <Textarea placeholder="Describe the threat..." value={formData?.description ?? ''} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => update('description', e.target.value)} className="text-sm min-h-[60px]" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Affected Assets</Label>
          <Input placeholder="Systems affected" value={formData?.affectedAssets ?? ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => update('affectedAssets', e.target.value)} className="h-8 text-sm" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Source</Label>
          <Input placeholder="NVD, VirusTotal..." value={formData?.source ?? ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => update('source', e.target.value)} className="h-8 text-sm" />
        </div>
      </div>
      <Button type="submit" className="w-full" loading={submitting}>Add Threat</Button>
    </form>
  );
}
