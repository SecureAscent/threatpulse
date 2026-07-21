export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext, isAdmin } from '@/lib/tenant-context';
import { prisma } from '@/lib/db';

/**
 * GET /api/admin/collector-health  (ADMIN+)
 *
 * Returns the latest run per collector source, a rollup of the last 24h, and
 * catalog totals so the dashboard can render source status cards and an
 * overall health summary.
 */

// The canonical set of sources we expect to see. Keeps cards visible even
// before a source has ever run.
const KNOWN_SOURCES: { key: string; label: string }[] = [
  { key: 'cisa_kev', label: 'CISA KEV' },
  { key: 'nvd', label: 'NVD' },
  { key: 'rss', label: 'RSS Feeds' },
];

const COLLECTOR_INTERVAL_MINUTES = Number(process.env.COLLECTOR_INTERVAL_MINUTES || 15);

export async function GET(req: NextRequest) {
  const ctx = await getTenantContext(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(ctx)) {
    return NextResponse.json({ error: 'Admin privileges required' }, { status: 403 });
  }

  // Latest run per distinct source (from the last 200 runs, newest first).
  const recentRuns = await prisma.collectorRun.findMany({
    orderBy: { startedAt: 'desc' },
    take: 200,
  });

  const latestBySource = new Map<string, (typeof recentRuns)[number]>();
  const seenKeys = new Set<string>();
  for (const run of recentRuns) {
    if (!latestBySource.has(run.source)) latestBySource.set(run.source, run);
    seenKeys.add(run.source);
  }

  // Merge known + observed sources.
  const sourceKeys = new Set<string>([...KNOWN_SOURCES.map((s) => s.key), ...seenKeys]);
  const labelFor = (key: string) =>
    KNOWN_SOURCES.find((s) => s.key === key)?.label ??
    key.replace(/^rss_/, 'RSS: ').replace(/_/g, ' ');

  const sources = Array.from(sourceKeys).map((key) => {
    const run = latestBySource.get(key);
    const nextRunEstimate = run?.completedAt
      ? new Date(new Date(run.completedAt).getTime() + COLLECTOR_INTERVAL_MINUTES * 60_000)
      : null;
    return {
      key,
      label: labelFor(key),
      status: run?.status ?? 'unknown',
      lastRunAt: run?.startedAt ?? null,
      completedAt: run?.completedAt ?? null,
      durationMs: run?.durationMs ?? null,
      itemsFound: run?.itemsFound ?? 0,
      itemsNew: run?.itemsNew ?? 0,
      itemsUpdated: run?.itemsUpdated ?? 0,
      itemsSkipped: run?.itemsSkipped ?? 0,
      errorMessage: run?.errorMessage ?? null,
      nextRunEstimate,
    };
  });

  // Overall health summary.
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayAgo = new Date(now.getTime() - 86_400_000);

  const [totalThreats, threatsToday, lastSuccess, runs24h] = await Promise.all([
    prisma.threat.count(),
    prisma.threat.count({ where: { dateAdded: { gte: startOfDay } } }),
    prisma.collectorRun.findFirst({
      where: { status: 'success' },
      orderBy: { completedAt: 'desc' },
    }),
    prisma.collectorRun.findMany({
      where: { startedAt: { gte: dayAgo } },
      select: { status: true, itemsNew: true },
    }),
  ]);

  const runs24hTotal = runs24h.length;
  const runs24hErrors = runs24h.filter((r) => r.status === 'error').length;
  const newItems24h = runs24h.reduce((sum, r) => sum + (r.itemsNew ?? 0), 0);

  const anyError = sources.some((s) => s.status === 'error');
  const anyUnknown = sources.every((s) => s.status === 'unknown');
  const overallStatus = anyUnknown ? 'unknown' : anyError ? 'degraded' : 'healthy';

  return NextResponse.json({
    overall: {
      status: overallStatus,
      lastSuccessfulAt: lastSuccess?.completedAt ?? null,
      totalThreats,
      threatsToday,
      runs24hTotal,
      runs24hErrors,
      newItems24h,
      intervalMinutes: COLLECTOR_INTERVAL_MINUTES,
    },
    sources,
  });
}
