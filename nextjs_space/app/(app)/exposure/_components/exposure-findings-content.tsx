'use client';
import { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { FadeIn } from '@/components/ui/animate';
import { Radar, Search, Loader2 } from 'lucide-react';

const kindConfig: Record<string, { label: string; badge: string }> = {
  credential_leak: { label: 'Credential Leak', badge: 'bg-red-500/10 text-red-500 border-red-500/20' },
  mention: { label: 'Mention', badge: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
  domain_exposure: { label: 'Domain Exposure', badge: 'bg-orange-500/10 text-orange-500 border-orange-500/20' },
  identity_exposure: { label: 'Identity Exposure', badge: 'bg-purple-500/10 text-purple-500 border-purple-500/20' },
};

const statusBadge: Record<string, string> = {
  new: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  validated: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  false_positive: 'bg-muted text-muted-foreground border-border',
  remediated: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
};

const sevBadge: Record<string, string> = {
  CRITICAL: 'bg-red-500/10 text-red-500 border-red-500/20',
  HIGH: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  MEDIUM: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  LOW: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
};

function relTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 60) return `${min}m ago`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function ExposureFindingsContent() {
  const [findings, setFindings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');

  const fetchFindings = useCallback(async () => {
    try {
      const res = await fetch('/api/exposure/findings');
      if (res.ok) {
        const data = await res.json();
        setFindings(data?.findings ?? []);
      }
    } catch (err) {
      console.error('Exposure fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchFindings(); }, [fetchFindings]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return findings.filter((f) => {
      if (kindFilter !== 'all' && f.kind !== kindFilter) return false;
      if (statusFilter !== 'all' && f.status !== statusFilter) return false;
      if (severityFilter !== 'all' && (f.severity || '').toUpperCase() !== severityFilter) return false;
      if (!q) return true;
      return [f.title, f.summary, f.affectedIdentity, f.credentialSample, f.sourceUrl]
        .filter(Boolean).some((v) => v.toLowerCase().includes(q));
    });
  }, [findings, search, kindFilter, statusFilter, severityFilter]);

  const stats = useMemo(() => {
    const byKind: Record<string, number> = {};
    findings.forEach((f) => { byKind[f.kind] = (byKind[f.kind] || 0) + 1; });
    return {
      total: findings.length,
      critical: findings.filter((f) => (f.severity || '').toUpperCase() === 'CRITICAL' && f.status !== 'remediated').length,
      remediated: findings.filter((f) => f.status === 'remediated').length,
      credLeaks: byKind.credential_leak || 0,
    };
  }, [findings]);

  return (
    <div className="p-6 space-y-6 max-w-[1200px] mx-auto">
      <FadeIn>
        <div className="flex items-center gap-2 mb-1">
          <Radar className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-display font-bold tracking-tight">Exposure Monitoring</h1>
        </div>
        <p className="text-sm text-muted-foreground">Credential leaks, identity exposures, and dark-web mentions across monitored watchlists.</p>
      </FadeIn>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Findings', value: stats.total, color: '' },
          { label: 'Critical Active', value: stats.critical, color: 'text-red-500' },
          { label: 'Remediated', value: stats.remediated, color: 'text-emerald-500' },
          { label: 'Credential Leaks', value: stats.credLeaks, color: '' },
        ].map((s) => (
          <Card key={s.label} className="border-border/50">
            <CardContent className="pt-4 pb-4 px-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{s.label}</p>
              <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search title, identity, credential sample…" className="pl-9" />
        </div>
        <select value={kindFilter} onChange={(e) => setKindFilter(e.target.value)} className="h-10 px-3 rounded-lg border border-input bg-background text-sm">
          <option value="all">All kinds</option>
          <option value="credential_leak">Credential Leak</option>
          <option value="mention">Mention</option>
          <option value="domain_exposure">Domain Exposure</option>
          <option value="identity_exposure">Identity Exposure</option>
        </select>
        <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)} className="h-10 px-3 rounded-lg border border-input bg-background text-sm">
          <option value="all">All severities</option>
          <option value="CRITICAL">Critical</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
          <option value="LOW">Low</option>
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-10 px-3 rounded-lg border border-input bg-background text-sm">
          <option value="all">All statuses</option>
          <option value="new">New</option>
          <option value="validated">Validated</option>
          <option value="false_positive">False Positive</option>
          <option value="remediated">Remediated</option>
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed"><CardContent className="pt-10 pb-10 text-center">
          <Radar className="w-8 h-8 text-muted-foreground mx-auto mb-3 opacity-50" />
          <p className="text-sm text-muted-foreground">No exposure findings yet.</p>
          <Link href="/exposure/watchlists" className="inline-flex items-center gap-1 text-sm text-primary hover:underline mt-2">Configure watchlists →</Link>
        </CardContent></Card>
      ) : (
        <Card className="border-border/50 overflow-hidden">
          <div className="grid grid-cols-12 gap-3 px-4 py-2.5 border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
            <div className="col-span-7 sm:col-span-5">Finding</div>
            <div className="col-span-3 hidden sm:block">Identity</div>
            <div className="col-span-2 hidden sm:block">Sev</div>
            <div className="col-span-5 sm:col-span-2">Status</div>
            <div className="col-span-2 hidden sm:block">First Seen</div>
          </div>
          <div className="divide-y divide-border">
            {filtered.map((f) => {
              const kc = kindConfig[f.kind] || kindConfig.mention;
              return (
                <Link key={f.id} href={`/exposure/${f.id}`} className="grid grid-cols-12 gap-3 px-4 py-3 items-center text-sm hover:bg-accent/40 transition-colors">
                  <div className="col-span-7 sm:col-span-5 min-w-0">
                    <p className="font-medium truncate">{f.title || 'Untitled finding'}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${kc.badge}`}>{kc.label}</span>
                      {f.sourceUrl && <span className="text-[10px] text-muted-foreground truncate">{(() => { try { return new URL(f.sourceUrl).hostname; } catch { return f.sourceUrl; } })()}</span>}
                    </div>
                  </div>
                  <div className="col-span-3 hidden sm:block min-w-0"><p className="font-mono text-xs truncate text-muted-foreground">{f.affectedIdentity || '—'}</p></div>
                  <div className="col-span-2 hidden sm:block"><Badge className={`text-[10px] ${sevBadge[(f.severity || '').toUpperCase()] ?? ''}`}>{f.severity}</Badge></div>
                  <div className="col-span-5 sm:col-span-2"><span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${statusBadge[f.status] || statusBadge.new}`}>{(f.status || 'new').replace('_', ' ')}</span></div>
                  <div className="col-span-2 hidden sm:block text-xs text-muted-foreground">{relTime(f.firstSeen || f.retrievedAt || f.createdAt)}</div>
                </Link>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}