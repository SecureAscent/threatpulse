export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getTenantContext, hasPermission } from '@/lib/tenant-context';

// GET /api/org/analysts — list users in the caller's organization who can be
// assigned threats (used to populate the assignment dropdown). Requires
// threats.manage so only ANALYST+ can see the roster.
export async function GET(req: NextRequest) {
  try {
    const ctx = await getTenantContext(req);
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasPermission(ctx, 'threats.manage')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (!ctx.organizationId) return NextResponse.json({ analysts: [] });

    const analysts = await prisma.user.findMany({
      where: {
        organizationId: ctx.organizationId,
        role: { in: ['ANALYST', 'DEPARTMENT_ADMIN', 'ADMIN', 'PARENT_ADMIN', 'SUPERADMIN'] },
      },
      select: { id: true, name: true, email: true, role: true },
      orderBy: [{ name: 'asc' }, { email: 'asc' }],
    });

    return NextResponse.json({ analysts });
  } catch (error: any) {
    console.error('GET org analysts error:', error);
    return NextResponse.json({ error: 'Failed to fetch analysts' }, { status: 500 });
  }
}
