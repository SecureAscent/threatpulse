export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { FRAMEWORK_LABELS } from '@/lib/compliance-mappings';

function csvCell(v: any): string {
  const s = v == null ? '' : String(v);
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

// GET /api/compliance/export
// Returns a CSV of every threat -> control mapping (the gap report source data).
export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = session.user as any;
    const isSuper = user?.role === 'SUPERADMIN';
    const orgId = user?.organizationId;
    if (!isSuper && !orgId) return NextResponse.json({ error: 'No organization' }, { status: 400 });

    const threatWhere: any = isSuper ? {} : { organizationId: orgId };

    const tags = await prisma.complianceTag.findMany({
      where: { threat: threatWhere },
      select: {
        framework: true,
        controlId: true,
        controlName: true,
        createdAt: true,
        threat: { select: { threatId: true, title: true, severity: true, status: true, isKev: true } },
      },
      orderBy: [{ framework: 'asc' }, { controlId: 'asc' }],
    });

    const header = [
      'Framework', 'Control ID', 'Control Name',
      'Threat ID', 'Threat Title', 'Severity', 'Status', 'KEV', 'Tagged At',
    ];
    const lines = [header.map(csvCell).join(',')];
    for (const t of tags) {
      lines.push([
        FRAMEWORK_LABELS[t.framework] ?? t.framework,
        t.controlId,
        t.controlName,
        t.threat?.threatId ?? '',
        t.threat?.title ?? '',
        t.threat?.severity ?? '',
        t.threat?.status ?? '',
        t.threat?.isKev ? 'Yes' : 'No',
        t.createdAt ? new Date(t.createdAt).toISOString() : '',
      ].map(csvCell).join(','));
    }

    const csv = lines.join('\n');
    const filename = `compliance-gap-report-${new Date().toISOString().slice(0, 10)}.csv`;
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error('Compliance export error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
