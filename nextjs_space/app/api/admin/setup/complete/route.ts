export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext, hasRole } from '@/lib/tenant-context';
import { prisma } from '@/lib/db';
import { writeAuditEvent } from '@/lib/audit';
import { getClientIp } from '@/lib/rate-limit';

/**
 * Mark the organization's production setup as complete. SUPERADMIN only.
 * Pass `{ completed: false }` to re-open the checklist.
 */
export async function POST(req: NextRequest) {
  const ctx = await getTenantContext(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasRole(ctx, 'SUPERADMIN')) {
    return NextResponse.json({ error: 'SUPERADMIN privileges required' }, { status: 403 });
  }
  if (!ctx.organizationId) return NextResponse.json({ error: 'No organization context' }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const completed = body?.completed === false ? false : true;

  const org = await prisma.organization.update({
    where: { id: ctx.organizationId },
    data: { setupCompleted: completed },
  });

  await writeAuditEvent({
    action: completed ? 'setup.completed' : 'setup.reopened',
    ctx,
    targetType: 'Organization',
    targetId: org.id,
    ipAddress: getClientIp(req.headers),
  });

  return NextResponse.json({ success: true, setupCompleted: org.setupCompleted });
}
