export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { getComplianceMappings } from '@/lib/compliance-mappings';

// POST /api/compliance/sync
// Auto-tags all in-scope threats with compliance controls using the static
// mapping. Idempotent: clears existing tags for those threats, then recreates.
export async function POST(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = session.user as any;
    const isSuper = user?.role === 'SUPERADMIN';
    const orgId = user?.organizationId;
    if (!isSuper && !orgId) return NextResponse.json({ error: 'No organization' }, { status: 400 });

    const threatWhere: any = isSuper ? {} : { organizationId: orgId };

    const threats = await prisma.threat.findMany({
      where: threatWhere,
      select: { id: true, severity: true, isKev: true, mitreAttackIds: true },
    });

    if (threats.length === 0) {
      return NextResponse.json({ threatsProcessed: 0, tagsCreated: 0 });
    }

    const threatIds = threats.map((t) => t.id);

    // Build all tag rows from the static mapping.
    const rows: { threatId: string; framework: string; controlId: string; controlName: string }[] = [];
    for (const t of threats) {
      const mappings = getComplianceMappings({
        severity: t.severity,
        isKev: t.isKev,
        mitreAttackIds: t.mitreAttackIds ?? [],
      });
      for (const m of mappings) {
        rows.push({ threatId: t.id, framework: m.framework, controlId: m.controlId, controlName: m.controlName });
      }
    }

    // Idempotent replace within a transaction.
    const result = await prisma.$transaction(async (tx) => {
      await tx.complianceTag.deleteMany({ where: { threatId: { in: threatIds } } });
      const created = await tx.complianceTag.createMany({ data: rows });
      return created;
    });

    return NextResponse.json({
      threatsProcessed: threats.length,
      tagsCreated: result.count ?? rows.length,
    });
  } catch (error: any) {
    console.error('Compliance sync error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
