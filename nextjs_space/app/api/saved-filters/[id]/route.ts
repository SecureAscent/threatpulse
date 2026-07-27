export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getTenantContext, hasPermission, isAdmin } from '@/lib/tenant-context';
import { writeAuditEvent } from '@/lib/audit';

// DELETE /api/saved-filters/[id] — delete a saved filter.
// Owners may delete their own; ADMIN+ may delete any shared filter in their org.
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await getTenantContext(req);
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasPermission(ctx, 'threats.read')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const filter = await prisma.savedFilter.findUnique({ where: { id: params?.id } });
    if (!filter || (ctx.organizationId && filter.organizationId !== ctx.organizationId)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const isOwner = filter.userId === ctx.userId;
    if (!isOwner && !isAdmin(ctx)) {
      return NextResponse.json(
        { error: 'You can only delete your own saved filters' },
        { status: 403 },
      );
    }

    await prisma.savedFilter.delete({ where: { id: filter.id } });

    await writeAuditEvent({
      action: 'threat.filter.deleted',
      ctx,
      targetType: 'savedFilter',
      targetId: filter.id,
      metadata: { name: filter.name, deletedByOwner: isOwner },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('DELETE saved-filter error:', error);
    return NextResponse.json({ error: 'Failed to delete saved filter' }, { status: 500 });
  }
}
