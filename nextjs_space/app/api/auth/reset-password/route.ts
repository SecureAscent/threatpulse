export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { sha256 } from '@/lib/crypto';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { writeAuditEvent } from '@/lib/audit';

/**
 * Complete a password reset. Validates the token (unused + unexpired),
 * sets the new bcrypt-hashed password, and marks the token consumed.
 * All of the user's active sessions are revoked as a precaution.
 */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const rl = rateLimit(`reset:${ip}`, 5, 60 * 60 * 1000); // 5 per hour per IP
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const token = (body?.token || '').toString();
  const newPassword = (body?.newPassword || '').toString();

  if (!token || !newPassword) {
    return NextResponse.json({ error: 'Token and new password are required' }, { status: 400 });
  }
  if (newPassword.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
  }

  const tokenHash = sha256(token);
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });

  if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
    return NextResponse.json({ error: 'This reset link is invalid or has expired.' }, { status: 400 });
  }

  const hashedPassword = await bcrypt.hash(newPassword, 12);

  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { password: hashedPassword } }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    // Revoke active sessions so a stolen session cannot outlive the reset.
    prisma.activeSession.updateMany({
      where: { userId: record.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  const user = await prisma.user.findUnique({ where: { id: record.userId } });
  await writeAuditEvent({
    action: 'password.reset_completed',
    userId: record.userId,
    organizationId: user?.organizationId ?? null,
    actorEmail: user?.email ?? null,
    ipAddress: ip,
  });

  return NextResponse.json({ success: true });
}
