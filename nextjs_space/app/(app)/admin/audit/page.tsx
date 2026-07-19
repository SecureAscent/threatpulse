'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, FileSearch, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FadeIn } from '@/components/ui/animate';

type AuditEvent = {
  id: string;
  organizationId: string;
  actorUserId: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string | null;
  departmentId: string | null;
  metadata: unknown;
  createdAt: string;
  organization: { id: string; name: string; slug: string };
  actor: { id: string; name: string | null; email: string } | null;
};

type AuditResponse = {
  events: AuditEvent[];
  page: number;
  pageSize: number;
  total: number;
  message?: string;
};

async function readJson(response: Response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || payload?.error || 'Request failed');
  return payload;
}

function formatAction(action: string) {
  return action.replace(/[._-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function metadataPreview(metadata: unknown) {
  if (!metadata) return '—';
  try {
    const value = JSON.stringify(metadata);
    return value.length > 100 ? `${value.slice(0, 100)}…` : value;
  } catch {
    return 'Unavailable';
  }
}

export default function AuditPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [total, setTotal] = useState(0);
  const [actionInput, setActionInput] = useState('');
  const [entityInput, setEntityInput] = useState('');
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (action) params.set('action', action);
      if (entityType) params.set('entityType', entityType);
      const response = await fetch(`/api/admin/audit?${params.toString()}`, { cache: 'no-store' });
      const payload = (await readJson(response)) as AuditResponse;
      setEvents(payload.events ?? []);
      setTotal(payload.total ?? 0);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load audit events.');
    } finally {
      setLoading(false);
    }
  }, [action, entityType, page, pageSize]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const uniqueActors = useMemo(() => new Set(events.map((event) => event.actorUserId)).size, [events]);

  function submitFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setAction(actionInput.trim());
    setEntityType(entityInput.trim());
  }

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <FadeIn>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-primary"><ShieldCheck className="h-4 w-4" />Administration</div>
            <h1 className="text-2xl font-display font-bold tracking-tight">Audit Log</h1>
            <p className="text-sm text-muted-foreground mt-1">Review tenant-scoped administrative and security changes.</p>
          </div>
          <Button variant="outline" onClick={() => void loadEvents()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh</Button>
        </div>
      </FadeIn>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground">Matching events</p><p className="text-2xl font-bold mt-1">{total}</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground">Actors on page</p><p className="text-2xl font-bold mt-1">{uniqueActors}</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground">Page</p><p className="text-2xl font-bold mt-1">{page} / {totalPages}</p></CardContent></Card>
      </div>

      {error && <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}

      <Card>
        <CardHeader className="border-b"><CardTitle className="text-sm flex items-center gap-2"><FileSearch className="h-4 w-4" />Event filters</CardTitle></CardHeader>
        <CardContent className="pt-4">
          <form onSubmit={submitFilters} className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
            <Input value={actionInput} onChange={(event) => setActionInput(event.target.value)} placeholder="Filter action, e.g. organization.update" />
            <Input value={entityInput} onChange={(event) => setEntityInput(event.target.value)} placeholder="Filter entity type, e.g. User" />
            <Button type="submit"><Search className="mr-2 h-4 w-4" />Apply filters</Button>
          </form>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Time</TableHead><TableHead>Actor</TableHead><TableHead>Organization</TableHead><TableHead>Action</TableHead><TableHead>Entity</TableHead><TableHead>Metadata</TableHead></TableRow></TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="h-32 text-center text-muted-foreground">Loading audit events…</TableCell></TableRow>
              ) : events.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="h-32 text-center text-muted-foreground">No audit events match the current filters.</TableCell></TableRow>
              ) : events.map((event) => (
                <TableRow key={event.id}>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{new Date(event.createdAt).toLocaleString()}</TableCell>
                  <TableCell><div className="font-medium text-sm">{event.actor?.name || event.actor?.email || event.actorUserId}</div><div className="text-xs text-muted-foreground">{event.actorRole}</div></TableCell>
                  <TableCell><div className="text-sm">{event.organization.name}</div><div className="font-mono text-xs text-muted-foreground">{event.organization.slug}</div></TableCell>
                  <TableCell><Badge variant="outline">{formatAction(event.action)}</Badge></TableCell>
                  <TableCell><div className="text-sm">{event.entityType}</div><div className="font-mono text-xs text-muted-foreground max-w-[180px] truncate">{event.entityId || '—'}</div></TableCell>
                  <TableCell className="max-w-[320px]"><code className="text-xs text-muted-foreground break-all">{metadataPreview(event.metadata)}</code></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Showing {events.length} of {total} events</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1 || loading}><ChevronLeft className="h-4 w-4 mr-1" />Previous</Button>
          <Button variant="outline" size="sm" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page >= totalPages || loading}>Next<ChevronRight className="h-4 w-4 ml-1" /></Button>
        </div>
      </div>
    </div>
  );
}
