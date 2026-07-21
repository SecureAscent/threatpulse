export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/tenant-context';
import { prisma } from '@/lib/db';
import { verifyTotp } from '@/lib/mfa';
import { generateBackupCodes, sha256 } from '@/lib/crypto';
import { writeAuditEvent } from '@/lib/audit';

/**
 * Confirm MFA enrolment by verifying a TOTP token. On success, marks the
 * secret verified and returns a fresh set of one-time backup codes (shown
 * only once — only their hashes are stored).
 */
export async function POST(req: NextRequest) {
  const ctx = await getTenantContext();
  if (!ctx || !ctx.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const token = (body?.token || '').toString();
  if (!token) {
    return NextResponse.json({ error: 'Verification code required' }, { status: 400 });
  }

  const mfa = await prisma.mfaSecret.findUnique({ where: { userId: ctx.userId } });
  if (!mfa) {
    return NextResponse.json({ error: 'Start MFA setup first' }, { status: 400 });
  }
  if (mfa.verified) {
    return NextResponse.json({ error: 'MFA already enabled' }, { status: 400 });
  }

  if (!verifyTotp(token, mfa.secret)) {
    return NextResponse.json({ error: 'Invalid verification code' }, { status: 400 });
  }

  const backupCodes = generateBackupCodes(8);
  const hashed = backupCodes.map((c) => sha256(c.toUpperCase().replace(/\s/g, '')));

  await prisma.mfaSecret.update({
    where: { userId: ctx.userId },
    data: { verified: true, backupCodes: hashed },
  });

  await writeAuditEvent({ action: 'mfa.enabled', ctx, targetType: 'User', targetId: ctx.userId });

  // Return the plaintext codes ONCE.
  return NextResponse.json({ success: true, backupCodes });
}
