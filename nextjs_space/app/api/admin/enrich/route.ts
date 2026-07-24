export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext, hasRole } from '@/lib/tenant-context';
import { prisma } from '@/lib/db';
import { fetchEpssScores, extractCveId } from '@/lib/enrichment/epss';
import { inferMitreAttackIds } from '@/lib/enrichment/mitre';
import { calculateRiskScore, ageInDaysFrom, inferKev } from '@/lib/risk-score';

/**
 * POST /api/admin/enrich  (SUPERADMIN only)
 *
 * Enriches threats with EPSS scores (FIRST.org), infers MITRE ATT&CK
 * technique ids, recomputes the composite risk score, and persists the
 * results. Threats are matched to a CVE via their threatId or title.
 *
 * Body (optional): { limit?: number, onlyMissing?: boolean }
 *   - limit: cap the number of threats processed (default 2000)
 *   - onlyMissing: only enrich threats without an epssUpdatedAt (default true)
 */
export async function POST(req: NextRequest) {
  const ctx = await getTenantContext(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasRole(ctx, 'SUPERADMIN')) {
    return NextResponse.json({ error: 'SUPERADMIN privileges required' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const limit = Math.min(Math.max(Number(body?.limit) || 2000, 1), 10000);
  const onlyMissing = body?.onlyMissing === undefined ? true : Boolean(body.onlyMissing);

  const started = Date.now();

  const threats = await prisma.threat.findMany({
    where: onlyMissing ? { epssUpdatedAt: null } : {},
    orderBy: { dateAdded: 'desc' },
    take: limit,
    select: {
      id: true,
      threatId: true,
      title: true,
      description: true,
      type: true,
      severity: true,
      source: true,
      cvssScore: true,
      dateAdded: true,
      affectedAssets: true,
      mitreTactic: true,
      mitreTechnique: true,
      isKev: true,
      exploitAvailable: true,
    },
  });

  // Map each threat to its CVE id (if any).
  const cveByThreat = new Map<string, string>();
  const cveSet = new Set<string>();
  for (const t of threats) {
    const cve = extractCveId(t.threatId, t.title);
    if (cve) {
      cveByThreat.set(t.id, cve);
      cveSet.add(cve);
    }
  }

  // Fetch EPSS for all CVEs in one batched call set (fails soft).
  const epss = await fetchEpssScores(Array.from(cveSet));

  let enriched = 0;
  let failed = 0;
  const now = new Date();

  const BATCH = 100;
  for (let i = 0; i < threats.length; i += BATCH) {
    const slice = threats.slice(i, i + BATCH);
    try {
      await prisma.$transaction(
        slice.map((t) => {
          const cve = cveByThreat.get(t.id);
          const score = cve ? epss.get(cve) : undefined;
          const mitreIds = inferMitreAttackIds({
            type: t.type,
            title: t.title,
            description: t.description,
            mitreTactic: t.mitreTactic,
            mitreTechnique: t.mitreTechnique,
          });
          const isKev = t.isKev || inferKev(t.source);
          const epssScore = score?.probability ?? null;
          const epssPercentile = score?.percentile ?? null;

          const risk = calculateRiskScore({
            cvssScore: t.cvssScore,
            epssScore,
            epssPercentile,
            isKev,
            exploitAvailable: t.exploitAvailable,
            severity: t.severity,
            ageInDays: ageInDaysFrom(t.dateAdded),
            hasAffectedAssets: Boolean(t.affectedAssets && t.affectedAssets.trim()),
          });

          enriched++;
          return prisma.threat.update({
            where: { id: t.id },
            data: {
              ...(score
                ? { epssScore, epssPercentile, epssUpdatedAt: now }
                : {}),
              isKev,
              mitreAttackIds: { set: mitreIds },
              riskScore: risk,
              enrichedAt: now,
            },
          });
        }),
      );
    } catch (err) {
      failed += slice.length;
      enriched -= slice.length; // roll back the optimistic count for this batch
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[enrich] batch failed: ${msg}`);
    }
  }

  return NextResponse.json({
    enriched,
    failed,
    cvesQueried: cveSet.size,
    epssResolved: epss.size,
    durationMs: Date.now() - started,
  });
}
