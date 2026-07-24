'use client';
import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FadeIn } from '@/components/ui/animate';
import {
  Activity, RefreshCw, Play, Loader2, Sparkles, Calculator,
  CheckCircle2, AlertTriangle, HelpCircle, Database, Clock, Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

type SourceHealth = {
  key: string;
  label: string;
  status: 'success' | 'error' | 'running' | 'unknown';
  lastRunAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  itemsFound: number;
  itemsNew: number;
  itemsUpdated: number;
  itemsSkipped: number;
  errorMessage: string | null;
  nextRunEstimate: string | null;
};

type Health = {
  overall: {
    status: 'healthy' | 'degraded' | 'unknown';
    lastSuccessfulAt: string | null;
    totalThreats: number;
    threatsToday: number;
    runs24hTotal: number;
    runs24hErrors: number;
    newItems24h: number;
    intervalMinutes: number;
  };
  sources: SourceHealth[];
};

function rel(ts: string | null): string {
  if (!ts) return 'never';
  try {
    return formatDistanceToNow(new Date(ts), { addSuffix: true });
  } catch {
    return '—';
  }
}

function StatusBadge({ status }: { status: SourceHealth['status'] | Health['overall']['status'] }) {
  if (status === 'success' || status === 'healthy')
    return (
      <Badge variant="outline" className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30 gap-1">
        <CheckCircle2 className="w-3 h-3" /> Healthy
      </Badge>
    );
  if (status === 'error' || status === 'degraded')
    return (
      <Badge variant="outline" className="bg-red-500/15 text-red-500 border-red-500/30 gap-1">
        <AlertTriangle className="w-3 h-3" /> {status === 'error' ? 'Error' : 'Degraded'}
      </Badge>
    );
  if (status === 'running')
    return (
      <Badge variant="outline" className="bg-blue-500/15 text-blue-500 border-blue-500/30 gap-1">
        <Loader2 className="w-3 h-3 animate-spin" /> Running
      </Badge>
    );
  return (
    <Badge variant="outline" className="text-muted-foreground gap-1">
      <HelpCircle className="w-3 h-3" /> Unknown
    </Badge>
  );
}

export default function CollectorHealthContent() {
  const { data: session } = useSession() || {};
  const role = (session?.user as any)?.role as string | undefined;
  const isSuperAdmin = role === 'SUPERADMIN';

  const [health, setHealth] = useState<Health | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<string | null>(null);
  const [enriching, setEnriching] = useState(false);
  const [recalculating, setRecalculating] = useState(false);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const res = await fetch('/api/admin/collector-health', { cache: 'no-store' });
      if (res.ok) setHealth(await res.json());
      else if (!quiet) toast.error('Failed to load collector health');
    } catch {
      if (!quiet) toast.error('Failed to load collector health');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(() => load(true), 60_000);
    return () => clearInterval(t);
  }, [load]);

  const triggerRun = async (source?: string) => {
    setRunning(source ?? 'all');
    try {
      const res = await fetch('/api/admin/collector-health/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(source ? { source } : {}),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success(data?.message || 'Collection started');
        // The collector runs the cycle in the background, so poll the health
        // endpoint a few times to reflect the running → completed transition.
        let ticks = 0;
        const poll = setInterval(() => {
          load(true);
          if (++ticks >= 8) clearInterval(poll);
        }, 5000);
      } else {
        toast.error(data?.error || 'Failed to trigger collection run');
      }
    } catch {
      toast.error('Failed to reach collector service');
    } finally {
      setRunning(null);
    }
  };

  const runEnrich = async () => {
    setEnriching(true);
    try {
      const res = await fetch('/api/admin/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ onlyMissing: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success(
          `Enriched ${data?.enriched ?? 0} threats · ${data?.epssResolved ?? 0}/${data?.cvesQueried ?? 0} EPSS resolved`,
        );
        load(true);
      } else {
        toast.error(data?.error || 'Enrichment failed');
      }
    } catch {
      toast.error('Enrichment failed');
    } finally {
      setEnriching(false);
    }
  };

  const runRecalculate = async () => {
    setRecalculating(true);
    try {
      const res = await fetch('/api/admin/recalculate-scores', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success(`Recalculated risk scores for ${data?.updated ?? 0} threats`);
        load(true);
      } else {
        toast.error(data?.error || 'Recalculation failed');
      }
    } catch {
      toast.error('Recalculation failed');
    } finally {
      setRecalculating(false);
    }
  };

  const o = health?.overall;

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2">
            <Activity className="w-6 h-6 text-primary" /> Collector Health
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monitor threat intelligence collection sources and run enrichment jobs.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => load()} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Button size="sm" onClick={() => triggerRun()} disabled={running !== null}>
            {running === 'all' ? (
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
            ) : (
              <Play className="w-4 h-4 mr-1.5" />
            )}
            Run All
          </Button>
          {isSuperAdmin && (
            <>
              <Button id="enrich" variant="outline" size="sm" onClick={runEnrich} disabled={enriching}>
                {enriching ? (
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4 mr-1.5" />
                )}
                Enrich Threats
              </Button>
              <Button id="recalculate" variant="outline" size="sm" onClick={runRecalculate} disabled={recalculating}>
                {recalculating ? (
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                ) : (
                  <Calculator className="w-4 h-4 mr-1.5" />
                )}
                Recalculate Scores
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Overall summary */}
      <FadeIn>
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                System Status
              </CardTitle>
              {o && <StatusBadge status={o.status} />}
            </div>
            <CardDescription>
              Last successful collection {rel(o?.lastSuccessfulAt ?? null)} · runs every{' '}
              {o?.intervalMinutes ?? 15} min
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Metric icon={<Database className="w-4 h-4" />} label="Total threats" value={o?.totalThreats ?? 0} />
              <Metric icon={<Zap className="w-4 h-4" />} label="New today" value={o?.threatsToday ?? 0} />
              <Metric icon={<Clock className="w-4 h-4" />} label="Runs (24h)" value={o?.runs24hTotal ?? 0} />
              <Metric
                icon={<AlertTriangle className="w-4 h-4" />}
                label="Errors (24h)"
                value={o?.runs24hErrors ?? 0}
                danger={(o?.runs24hErrors ?? 0) > 0}
              />
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      {/* Source cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading && !health
          ? Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="animate-pulse h-52" />
            ))
          : health?.sources.map((s) => (
              <FadeIn key={s.key}>
                <Card className="h-full">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-sm">{s.label}</CardTitle>
                      <StatusBadge status={s.status} />
                    </div>
                    <CardDescription className="text-xs">
                      Last run {rel(s.lastRunAt)}
                      {s.durationMs != null && ` · ${(s.durationMs / 1000).toFixed(1)}s`}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-4 gap-1 text-center">
                      <Stat label="Found" value={s.itemsFound} />
                      <Stat label="New" value={s.itemsNew} accent />
                      <Stat label="Upd" value={s.itemsUpdated} />
                      <Stat label="Skip" value={s.itemsSkipped} />
                    </div>
                    {s.errorMessage && (
                      <p className="text-xs text-red-500 bg-red-500/10 rounded px-2 py-1.5 line-clamp-3">
                        {s.errorMessage}
                      </p>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => triggerRun(s.key)}
                      disabled={running !== null}
                    >
                      {running === s.key ? (
                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      ) : (
                        <Play className="w-3.5 h-3.5 mr-1.5" />
                      )}
                      Run Now
                    </Button>
                  </CardContent>
                </Card>
              </FadeIn>
            ))}
      </div>
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  danger?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
      <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
        {icon}
        {label}
      </div>
      <p className={`text-2xl font-bold mt-1 ${danger ? 'text-red-500' : ''}`}>
        {value.toLocaleString()}
      </p>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div>
      <p className={`text-lg font-semibold ${accent ? 'text-primary' : ''}`}>{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}
