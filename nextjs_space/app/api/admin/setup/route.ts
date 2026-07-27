export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext, isAdmin } from '@/lib/tenant-context';
import { prisma } from '@/lib/db';

/**
 * Report production-readiness state for the caller's organization, including
 * a computed checklist the UI renders. ADMIN/SUPERADMIN only.
 */
export async function GET(req: NextRequest) {
  const ctx = await getTenantContext(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(ctx)) return NextResponse.json({ error: 'Admin privileges required' }, { status: 403 });
  if (!ctx.organizationId) return NextResponse.json({ error: 'No organization context' }, { status: 400 });

  const org = await prisma.organization.findUnique({ where: { id: ctx.organizationId } });

  // Derive a couple of checklist signals from real data.
  const adminUsers = await prisma.user.findMany({
    where: {
      organizationId: ctx.organizationId,
      role: { in: ['ADMIN', 'SUPERADMIN', 'PARENT_ADMIN'] },
    },
    select: { id: true },
  });
  const adminIds = adminUsers.map((u) => u.id);
  const adminsWithMfa = adminIds.length
    ? await prisma.mfaSecret.count({
        where: { userId: { in: adminIds }, verified: true },
      })
    : 0;

  const userCount = await prisma.user.count({ where: { organizationId: ctx.organizationId } });

  return NextResponse.json({
    setupCompleted: !!org?.setupCompleted,
    signals: {
      adminCount: adminIds.length,
      adminsWithMfa,
      allAdminsHaveMfa: adminIds.length > 0 && adminsWithMfa >= adminIds.length,
      userCount,
    },
  });
}
