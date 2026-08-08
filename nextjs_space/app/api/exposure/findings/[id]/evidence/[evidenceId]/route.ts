export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export async function PATCH(req: NextRequest, { params }: { params: { id: string; evidenceId: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = session.user as any;
    const actor = user?.email || 'analyst';

    const body = await req.json();
    if (body.reveal) {
      const expires = new Date(Date.now() + 60 * 60 * 1000);
      const auditEntry = `${actor} @ ${new Date().toISOString()}`;
      const existing = await prisma.exposureEvidence.findUnique({ where: { id: params.evidenceId }, select: { revealAudit: true } });
      const newAudit = existing?.revealAudit ? `${existing.revealAudit}\n${auditEntry}` : auditEntry;
      await prisma.exposureEvidence.update({
        where: { id: params.evidenceId },
        data: { revealed: true, revealExpires: expires, revealAudit: newAudit },
      });
      return NextResponse.json({ ok: true, revealed: true });
    }
    return NextResponse.json({ ok: false });
  } catch (error: any) {
    console.error('PATCH evidence error:', error);
    return NextResponse.json({ error: 'Reveal failed' }, { status: 500 });
  }
}
