export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = session.user as any;
    const orgId = user?.organizationId;

    const finding = await prisma.exposureFinding.findFirst({
      where: { id: params.id, ...(orgId ? { organizationId: orgId } : {}) },
      include: { evidence: { orderBy: { capturedDate: 'desc' } } },
    });
    if (!finding) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ finding });
  } catch (error: any) {
    console.error('GET exposure finding error:', error);
    return NextResponse.json({ error: 'Failed to fetch finding' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = session.user as any;
    const orgId = user?.organizationId;
    const actor = user?.email || user?.name || 'analyst';

    const body = await req.json();
    const update: any = {};
    if (body.status) update.status = body.status;
    if (body.assignedTo !== undefined) update.assignedTo = body.assignedTo;
    if (body.severity) update.severity = body.severity.toUpperCase();
    if (body.validationNote) {
      const stamp = new Date().toLocaleString();
      const existing = await prisma.exposureFinding.findUnique({ where: { id: params.id }, select: { validationNotes: true } });
      const entry = `[${stamp}] ${actor}: ${body.validationNote}`;
      update.validationNotes = existing?.validationNotes ? `${existing.validationNotes}\n\n${entry}` : entry;
    }

    const finding = await prisma.exposureFinding.updateMany({
      where: { id: params.id, ...(orgId ? { organizationId: orgId } : {}) },
      data: update,
    });
    if (finding.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('PATCH exposure finding error:', error);
    return NextResponse.json({ error: 'Failed to update finding' }, { status: 500 });
  }
}
