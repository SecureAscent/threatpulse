export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/tenant-context';
import { prisma } from '@/lib/db';

export async function GET() {
  const ctx = await getTenantContext();
  if (!ctx || !ctx.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const mfa = await prisma.mfaSecret.findUnique({ where: { userId: ctx.userId } });
  return NextResponse.json({
    enabled: !!mfa,
    verified: !!mfa?.verified,
    backupCodesRemaining: mfa?.backupCodes.length ?? 0,
  });
}
