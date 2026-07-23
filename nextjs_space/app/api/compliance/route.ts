export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { CONTROL_CATALOG, FRAMEWORK_LABELS, PRIMARY_FRAMEWORKS } from '@/lib/compliance-mappings';

// GET /api/compliance
// Returns coverage summary per framework based on ComplianceTag rows for the
// org's threats.
export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = session.user as any;
    const isSuper = user?.role === 'SUPERADMIN';
    const orgId = user?.organizationId;
    if (!isSuper && !orgId) return NextResponse.json({ frameworks: [] });

    const threatWhere: any = isSuper ? {} : { organizationId: orgId };

    // Count threats mapped to each (framework, controlId) within scope.
    const tags = await prisma.complianceTag.findMany({
      where: { threat: threatWhere },
      select: { framework: true, controlId: true, threatId: true },
    });

    // controlId -> set of distinct threatIds
    const coverage = new Map<string, Set<string>>();
    for (const t of tags) {
      const key = `${t.framework}:${t.controlId}`;
      if (!coverage.has(key)) coverage.set(key, new Set());
      coverage.get(key)!.add(t.threatId);
    }

    const frameworks = PRIMARY_FRAMEWORKS.map((fw) => {
      const controls = CONTROL_CATALOG.filter((c) => c.framework === fw);
      const controlStats = controls.map((c) => {
        const threatCount = coverage.get(`${c.framework}:${c.controlId}`)?.size ?? 0;
        return {
          controlId: c.controlId,
          controlName: c.controlName,
          threatCount,
          covered: threatCount > 0,
        };
      });
      const coveredControls = controlStats.filter((c) => c.covered).length;
      const totalControls = controls.length;
      const coveragePercent = totalControls > 0 ? Math.round((coveredControls / totalControls) * 100) : 0;
      return {
        framework: fw,
        label: FRAMEWORK_LABELS[fw] ?? fw,
        totalControls,
        coveredControls,
        coveragePercent,
        controls: controlStats,
        gaps: controlStats.filter((c) => !c.covered),
      };
    });

    return NextResponse.json({ frameworks });
  } catch (error: any) {
    console.error('Compliance summary error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
