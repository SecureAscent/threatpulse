'use client';
import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckSquare, Search, X, Download } from 'lucide-react';
import { FadeIn } from '@/components/ui/animate';
import type { ThreatItem } from '@/lib/types';
import { statusBadgeClass, statusLabel, isActionedStatus, THREAT_STATUS_ORDER, statusMeta, isOverdue } from '@/lib/threat-status';
import Link from 'next/link';

const severityBadge: Record<string, string> = {
  CRITICAL: 'bg-red-500/10 text-red-500 border-red-500/20',
  HIGH: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  MEDIUM: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  LOW: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
};

// Actioned = any status past NEW (i.e. that has entered the workflow).
const ACTIONED_STATUSES = THREAT_STATUS_ORDER.filter(s => isActionedStatus(s));

export default function ActionedThreatsContent() {
  const [threats, setThreats] = useState<ThreatItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const fetchThreats = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`/api/threats?${params}`);
      if (res.ok) {
        const data = await res.json();
        // Only threats that have entered the workflow (anything actioned beyond NEW).
        const actioned = (data?.threats ?? []).filter((t: ThreatItem) => t.status && t.status !== 'NEW');
        setThreats(actioned);
      }
    } catch (err: any) { console.error(err); }
    finally { setLoading(false); }
  }, [search, statusFilter]);

  useEffect(() => { fetchThreats(); }, [fetchThreats]);

  const exportCsv = () => {
    const headers = ['Threat ID', 'Title', 'Type', 'Severity', 'Status', 'Assignee', 'Due Date', 'Tags', 'Last Updated'];
    const escape = (val: any) => {
      const s = val == null ? '' : String(val);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = threats.map(t => [
      t.threatId ?? '',
      t.title ?? '',
      t.type ?? '',
      t.severity ?? '',
      statusLabel(t.status),
      t.assignedTo ? (t.assignedTo.name || t.assignedTo.email) : '',
      t.dueDate ? new Date(t.dueDate).toLocaleDateString() : '',
      (t.tags ?? []).join('; '),
      t.lastUpdated ? new Date(t.lastUpdated).toLocaleDateString() : '',
    ].map(escape).join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `actioned-threats-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 space-y-6 max-w-[1200px] mx-auto">
      <FadeIn>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
              <CheckSquare className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold tracking-tight">Actioned Threats</h1>
              <p className="text-sm text-muted-foreground">Threats that have entered the analyst workflow</p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={exportCsv} disabled={threats.length === 0}>
            <Download className="w-3.5 h-3.5" /> Export CSV
          </Button>
        </div>
      </FadeIn>

      <Card className="border-border/50">
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search actioned threats..." className="pl-9 h-9" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={statusFilter} onValueChange={v => setStatusFilter(v === 'ALL' ? '' : v)}>
              <SelectTrigger className="w-[190px] h-9"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                {ACTIONED_STATUSES.map(s => (
                  <SelectItem key={s} value={s}>{statusMeta(s).label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(search || statusFilter) && (
              <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => { setSearch(''); setStatusFilter(''); }}>
                <X className="w-3 h-3" /> Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[130px]">ID</TableHead>
                <TableHead>Title</TableHead>
                <TableHead className="w-[90px]">Severity</TableHead>
                <TableHead className="w-[150px]">Status</TableHead>
                <TableHead className="w-[140px]">Assignee</TableHead>
                <TableHead className="w-[110px]">Due</TableHead>
                <TableHead className="w-[100px]">Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}><TableCell colSpan={7}><div className="h-8 bg-muted animate-pulse rounded" /></TableCell></TableRow>
              )) : threats.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No actioned threats yet</TableCell></TableRow>
              ) : threats.map((t: ThreatItem) => {
                const overdue = isOverdue(t.dueDate ?? null, t.status);
                return (
                  <TableRow key={t.id} className="hover:bg-muted/30">
                    <TableCell><Link href={`/threats/${t.id}`} className="font-mono text-xs text-primary hover:underline">{t.threatId}</Link></TableCell>
                    <TableCell className="text-sm truncate max-w-[280px]">
                      {t.title}
                      {(t.tags ?? []).length > 0 && (
                        <span className="ml-2 inline-flex gap-1 align-middle">
                          {(t.tags ?? []).slice(0, 3).map(tag => (
                            <Badge key={tag} variant="outline" className="text-[9px] px-1 py-0">{tag}</Badge>
                          ))}
                        </span>
                      )}
                    </TableCell>
                    <TableCell><Badge variant="outline" className={`text-[10px] ${severityBadge[t.severity] ?? ''}`}>{t.severity}</Badge></TableCell>
                    <TableCell><Badge variant="outline" className={`text-[10px] ${statusBadgeClass(t.status)}`}>{statusLabel(t.status)}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground truncate max-w-[140px]">
                      {t.assignedTo ? (t.assignedTo.name || t.assignedTo.email) : <span className="text-orange-500">Unassigned</span>}
                    </TableCell>
                    <TableCell className={`text-xs ${overdue ? 'text-red-500 font-medium' : 'text-muted-foreground'}`}>
                      {t.dueDate ? new Date(t.dueDate).toLocaleDateString() : '—'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{t.lastUpdated ? new Date(t.lastUpdated).toLocaleDateString() : '—'}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
