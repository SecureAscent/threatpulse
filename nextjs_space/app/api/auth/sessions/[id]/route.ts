export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/tenant-context';
import { prisma } from '@/lib/db';
import { writeAuditEvent } from '@/lib/audit';

/**
 * Revoke sessions.
 *  - DELETE /api/auth/sessions/<id>       → revoke one session
 *  - DELETE /api/auth/sessions/others     → revoke all sessions except current
 */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await getTenantContext();
  if (!ctx || !ctx.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const currentToken = req.cookies.get('tp_sid')?.value ?? null;

  if (params.id === 'others') {
    const result = await prisma.activeSession.updateMany({
      where: {
        userId: ctx.userId,
        revokedAt: null,
        ...(currentToken ? { sessionToken: { not: currentToken } } : {}),
      },
      data: { revokedAt: new Date() },
    });
    await writeAuditEvent({
      action: 'session.revoked_others',
      ctx,
      metadata: { count: result.count },
    });
    return NextResponse.json({ success: true, revoked: result.count });
  }

  const target = await prisma.activeSession.findFirst({
    where: { id: params.id, userId: ctx.userId },
  });
  if (!target) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

  await prisma.activeSession.update({
    where: { id: target.id },
    data: { revokedAt: new Date() },
  });

  await writeAuditEvent({
    action: 'session.revoked',
    ctx,
    targetType: 'ActiveSession',
    targetId: target.id,
  });

  return NextResponse.json({ success: true });
}
