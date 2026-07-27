export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getTenantContext, hasPermission } from '@/lib/tenant-context';
import { writeAuditEvent } from '@/lib/audit';

const analystSelect = { id: true, name: true, email: true, role: true };

// PATCH /api/threats/[id]/assign — assign or unassign a threat to an analyst.
// Body: { assignedToId: string | null }
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await getTenantContext(req);
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasPermission(ctx, 'threats.manage')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const threat = await prisma.threat.findUnique({
      where: { id: params?.id },
      select: { id: true, assignedToId: true },
    });
    if (!threat) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const body = await req.json();
    const assignedToId: string | null =
      body?.assignedToId === null || body?.assignedToId === undefined || body?.assignedToId === ''
        ? null
        : String(body.assignedToId);

    // Validate the assignee exists and belongs to the same organization.
    if (assignedToId) {
      const assignee = await prisma.user.findUnique({
        where: { id: assignedToId },
        select: { id: true, organizationId: true },
      });
      if (!assignee) {
        return NextResponse.json({ error: 'Assignee not found' }, { status: 400 });
      }
      if (ctx.organizationId && assignee.organizationId !== ctx.organizationId) {
        return NextResponse.json(
          { error: 'Cannot assign a threat to a user outside your organization' },
          { status: 403 },
        );
      }
    }

    const updated = await prisma.threat.update({
      where: { id: params.id },
      data: { assignedToId },
      include: { assignedTo: { select: analystSelect } },
    });

    await writeAuditEvent({
      action: assignedToId ? 'threat.assigned' : 'threat.unassigned',
      ctx,
      targetType: 'threat',
      targetId: params.id,
      metadata: { previousAssigneeId: threat.assignedToId, assignedToId },
    });

    return NextResponse.json({ threat: updated });
  } catch (error: any) {
    console.error('PATCH threat assign error:', error);
    return NextResponse.json({ error: 'Failed to assign threat' }, { status: 500 });
  }
}
