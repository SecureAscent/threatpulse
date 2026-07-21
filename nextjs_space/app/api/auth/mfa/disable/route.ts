export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext, isAdmin } from '@/lib/tenant-context';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { writeAuditEvent } from '@/lib/audit';

/**
 * Disable MFA. A user may disable their own MFA by confirming their password.
 * An ADMIN/SUPERADMIN may disable MFA for another user in the same org
 * (e.g. account recovery) by passing `targetUserId` — no password required
 * for the admin path, but the action is audited.
 */
export async function POST(req: NextRequest) {
  const ctx = await getTenantContext();
  if (!ctx || !ctx.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const targetUserId = (body?.targetUserId || '').toString();
  const password = (body?.password || '').toString();

  // Admin-assisted disable for another user
  if (targetUserId && targetUserId !== ctx.userId) {
    if (!isAdmin(ctx)) {
      return NextResponse.json({ error: 'Admin privileges required' }, { status: 403 });
    }
    const target = await prisma.user.findFirst({
      where: { id: targetUserId, organizationId: ctx.organizationId ?? undefined },
    });
    if (!target) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    await prisma.mfaSecret.deleteMany({ where: { userId: targetUserId } });
    await writeAuditEvent({
      action: 'mfa.disabled_by_admin',
      ctx,
      targetType: 'User',
      targetId: targetUserId,
    });
    return NextResponse.json({ success: true });
  }

  // Self-disable — require password confirmation
  const user = await prisma.user.findUnique({ where: { id: ctx.userId } });
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }
  if (!password) {
    return NextResponse.json({ error: 'Password confirmation required' }, { status: 400 });
  }
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return NextResponse.json({ error: 'Incorrect password' }, { status: 400 });
  }

  await prisma.mfaSecret.deleteMany({ where: { userId: ctx.userId } });
  await writeAuditEvent({ action: 'mfa.disabled', ctx, targetType: 'User', targetId: ctx.userId });

  return NextResponse.json({ success: true });
}
