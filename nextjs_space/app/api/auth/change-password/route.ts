export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/tenant-context';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { writeAuditEvent } from '@/lib/audit';

/**
 * Change the signed-in user's password by confirming the current password.
 * On success, all other active sessions for the user are revoked.
 */
export async function POST(req: NextRequest) {
  const ctx = await getTenantContext();
  if (!ctx || !ctx.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const currentPassword = (body?.currentPassword || '').toString();
  const newPassword = (body?.newPassword || '').toString();

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: 'Current and new password are required' }, { status: 400 });
  }
  if (newPassword.length < 8) {
    return NextResponse.json({ error: 'New password must be at least 8 characters' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: ctx.userId } });
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const valid = await bcrypt.compare(currentPassword, user.password);
  if (!valid) {
    return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });
  }

  const hashed = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({ where: { id: ctx.userId }, data: { password: hashed } });

  // Invalidate all other sessions for security.
  await prisma.activeSession.deleteMany({ where: { userId: ctx.userId } });

  await writeAuditEvent({ action: 'password.changed', ctx, targetType: 'User', targetId: ctx.userId });

  return NextResponse.json({ success: true });
}
