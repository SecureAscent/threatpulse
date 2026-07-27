export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getTenantContext, hasPermission } from '@/lib/tenant-context';
import { writeAuditEvent } from '@/lib/audit';
import { isValidStatus } from '@/lib/threat-status';

type BulkAction = 'status' | 'assign' | 'due_date' | 'add_tags' | 'remove_tags';

// POST /api/threats/bulk — apply an action to many threats at once.
// Body: { threatIds: string[], action: BulkAction, payload: {...} }
export async function POST(req: NextRequest) {
  try {
    const ctx = await getTenantContext(req);
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasPermission(ctx, 'threats.manage')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const threatIds: string[] = Array.isArray(body?.threatIds)
      ? body.threatIds.map((x: any) => String(x)).filter(Boolean)
      : [];
    const action: BulkAction = body?.action;
    const payload = body?.payload ?? {};

    if (threatIds.length === 0) {
      return NextResponse.json({ error: 'threatIds is required' }, { status: 400 });
    }
    if (!['status', 'assign', 'due_date', 'add_tags', 'remove_tags'].includes(action)) {
      return NextResponse.json({ error: `Invalid action: ${action}` }, { status: 400 });
    }

    const existing = await prisma.threat.findMany({
      where: { id: { in: threatIds } },
      select: { id: true, status: true, tags: true },
    });
    const foundIds = existing.map((t) => t.id);
    if (foundIds.length === 0) {
      return NextResponse.json({ error: 'No matching threats' }, { status: 404 });
    }

    let updatedCount = 0;

    if (action === 'status') {
      const status = payload?.status;
      if (!isValidStatus(status)) {
        return NextResponse.json({ error: `Invalid status: ${status}` }, { status: 400 });
      }
      const note = payload?.note ? String(payload.note).trim() || null : null;
      await prisma.$transaction(async (tx) => {
        for (const t of existing) {
          await tx.threat.update({ where: { id: t.id }, data: { status } });
          if (t.status !== status && ctx.userId) {
            await tx.threatStatusHistory.create({
              data: {
                threatId: t.id,
                changedById: ctx.userId,
                fromStatus: t.status,
                toStatus: status,
                note,
              },
            });
          }
        }
      });
      updatedCount = existing.length;
    } else if (action === 'assign') {
      const assignedToId =
        payload?.assignedToId === null ||
        payload?.assignedToId === undefined ||
        payload?.assignedToId === ''
          ? null
          : String(payload.assignedToId);
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
            { error: 'Cannot assign to a user outside your organization' },
            { status: 403 },
          );
        }
      }
      const res = await prisma.threat.updateMany({
        where: { id: { in: foundIds } },
        data: { assignedToId },
      });
      updatedCount = res.count;
    } else if (action === 'due_date') {
      const dueDate = payload?.dueDate ? new Date(payload.dueDate) : null;
      const res = await prisma.threat.updateMany({
        where: { id: { in: foundIds } },
        data: { dueDate },
      });
      updatedCount = res.count;
    } else if (action === 'add_tags' || action === 'remove_tags') {
      const tags: string[] = Array.isArray(payload?.tags)
        ? payload.tags.map((x: any) => String(x).trim()).filter(Boolean)
        : [];
      if (tags.length === 0) {
        return NextResponse.json({ error: 'tags is required' }, { status: 400 });
      }
      await prisma.$transaction(
        existing.map((t) => {
          const current = new Set(t.tags ?? []);
          if (action === 'add_tags') {
            tags.forEach((tag) => current.add(tag));
          } else {
            tags.forEach((tag) => current.delete(tag));
          }
          return prisma.threat.update({
            where: { id: t.id },
            data: { tags: Array.from(current) },
          });
        }),
      );
      updatedCount = existing.length;
    }

    await writeAuditEvent({
      action: 'threat.bulk.updated',
      ctx,
      targetType: 'threat',
      targetId: foundIds.join(','),
      metadata: { action, payload, count: updatedCount, threatIds: foundIds },
    });

    return NextResponse.json({ success: true, updatedCount });
  } catch (error: any) {
    console.error('POST threats bulk error:', error);
    return NextResponse.json({ error: 'Failed to apply bulk action' }, { status: 500 });
  }
}
