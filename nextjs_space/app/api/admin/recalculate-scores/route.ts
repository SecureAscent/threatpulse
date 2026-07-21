export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext, hasRole } from '@/lib/tenant-context';
import { prisma } from '@/lib/db';
import { calculateRiskScore, ageInDaysFrom } from '@/lib/risk-score';
import { inferKev } from '@/lib/risk-score';

/**
 * POST /api/admin/recalculate-scores  (SUPERADMIN only)
 *
 * Recomputes the 0-100 composite ThreatPulse risk score for every threat in
 * the catalog using currently stored intelligence (CVSS, EPSS, KEV, exploit,
 * recency, asset exposure) and persists it.
 */
export async function POST(req: NextRequest) {
  const ctx = await getTenantContext(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasRole(ctx, 'SUPERADMIN')) {
    return NextResponse.json({ error: 'SUPERADMIN privileges required' }, { status: 403 });
  }

  const started = Date.now();
  const threats = await prisma.threat.findMany({
    select: {
      id: true,
      cvssScore: true,
      epssScore: true,
      epssPercentile: true,
      isKev: true,
      exploitAvailable: true,
      severity: true,
      source: true,
      dateAdded: true,
      affectedAssets: true,
      riskScore: true,
    },
  });

  let updated = 0;
  const BATCH = 200;
  for (let i = 0; i < threats.length; i += BATCH) {
    const slice = threats.slice(i, i + BATCH);
    await prisma.$transaction(
      slice.map((t) => {
        const isKev = t.isKev || inferKev(t.source);
        const score = calculateRiskScore({
          cvssScore: t.cvssScore,
          epssScore: t.epssScore,
          epssPercentile: t.epssPercentile,
          isKev,
          exploitAvailable: t.exploitAvailable,
          severity: t.severity,
          ageInDays: ageInDaysFrom(t.dateAdded),
          hasAffectedAssets: Boolean(t.affectedAssets && t.affectedAssets.trim()),
        });
        updated++;
        return prisma.threat.update({
          where: { id: t.id },
          data: { riskScore: score, isKev },
        });
      }),
    );
  }

  return NextResponse.json({
    ok: true,
    total: threats.length,
    updated,
    durationMs: Date.now() - started,
  });
}
