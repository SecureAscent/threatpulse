export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { randomToken, sha256 } from '@/lib/crypto';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { writeAuditEvent } from '@/lib/audit';

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Request a password reset. Always returns a generic success response to
 * avoid leaking which emails are registered. When a user exists, a reset
 * token is created and the reset URL is logged to the server console.
 * TODO: send this URL via email once SMTP is configured.
 */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const rl = rateLimit(`forgot:${ip}`, 5, 60 * 60 * 1000); // 5 per hour per IP
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt.getTime() - Date.now()) / 1000)) } },
    );
  }

  const body = await req.json().catch(() => ({}));
  const email = (body?.email || '').toString().trim().toLowerCase();

  const generic = NextResponse.json({
    success: true,
    message: 'If an account exists for that email, a reset link has been sent.',
  });

  if (!email) return generic;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return generic; // do not reveal absence

  // Invalidate any previous unused tokens for this user.
  await prisma.passwordResetToken.deleteMany({
    where: { userId: user.id, usedAt: null },
  });

  const rawToken = randomToken(32);
  const tokenHash = sha256(rawToken);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash, expiresAt },
  });

  const base = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || '';
  const resetUrl = `${base}/reset-password?token=${rawToken}`;

  // eslint-disable-next-line no-console
  console.log(`[password-reset] Reset link for ${email} (valid 1h): ${resetUrl}`);

  await writeAuditEvent({
    action: 'password.reset_requested',
    userId: user.id,
    organizationId: user.organizationId,
    actorEmail: email,
    ipAddress: ip,
  });

  return generic;
}
