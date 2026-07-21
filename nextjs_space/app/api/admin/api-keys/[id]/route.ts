export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext, isAdmin } from '@/lib/tenant-context';
import { prisma } from '@/lib/db';
import { writeAuditEvent } from '@/lib/audit';
import { getClientIp } from '@/lib/rate-limit';

/** Revoke (soft-delete) an API key. */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await getTenantContext(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(ctx)) return NextResponse.json({ error: 'Admin privileges required' }, { status: 403 });

  const key = await prisma.apiKey.findFirst({
    where: { id: params.id, organizationId: ctx.organizationId ?? undefined },
  });
  if (!key) return NextResponse.json({ error: 'API key not found' }, { status: 404 });
  if (key.revokedAt) return NextResponse.json({ success: true, alreadyRevoked: true });

  await prisma.apiKey.update({ where: { id: key.id }, data: { revokedAt: new Date() } });

  await writeAuditEvent({
    action: 'apikey.revoked',
    ctx,
    targetType: 'ApiKey',
    targetId: key.id,
    metadata: { name: key.name },
    ipAddress: getClientIp(req.headers),
  });

  return NextResponse.json({ success: true });
}
