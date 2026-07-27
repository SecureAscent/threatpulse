export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/tenant-context';
import { prisma } from '@/lib/db';
import { generateMfaSecret, buildOtpAuthUrl, buildQrCodeDataUrl } from '@/lib/mfa';
import { writeAuditEvent } from '@/lib/audit';

/**
 * Begin MFA enrolment: generate a TOTP secret and return it with a QR code.
 * The secret is stored unverified until the user confirms via /verify.
 * Re-running before verification rotates the secret; it will not clobber an
 * already-verified secret.
 */
export async function POST() {
  const ctx = await getTenantContext();
  if (!ctx || !ctx.userId || !ctx.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const existing = await prisma.mfaSecret.findUnique({ where: { userId: ctx.userId } });
  if (existing?.verified) {
    return NextResponse.json(
      { error: 'MFA is already enabled. Disable it first to re-enrol.' },
      { status: 400 },
    );
  }

  const secret = generateMfaSecret();
  await prisma.mfaSecret.upsert({
    where: { userId: ctx.userId },
    create: { userId: ctx.userId, secret, verified: false, backupCodes: [] },
    update: { secret, verified: false, backupCodes: [] },
  });

  const otpauthUrl = buildOtpAuthUrl(ctx.email, secret);
  const qrCode = await buildQrCodeDataUrl(otpauthUrl);

  await writeAuditEvent({ action: 'mfa.setup_started', ctx, targetType: 'User', targetId: ctx.userId });

  return NextResponse.json({ secret, otpauthUrl, qrCode });
}
