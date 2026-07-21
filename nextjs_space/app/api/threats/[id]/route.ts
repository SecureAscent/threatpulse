export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getTenantContext, hasPermission, isAdmin } from '@/lib/tenant-context';
import { writeAuditEvent } from '@/lib/audit';
import { isValidStatus } from '@/lib/threat-status';

const analystSelect = { id: true, name: true, email: true, role: true };

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await getTenantContext(req);
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasPermission(ctx, 'threats.read')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const orgId = ctx.organizationId;
    // Threat itself is global; tickets and asset links stay scoped to the caller's org.
    const threat = await prisma.threat.findUnique({
      where: { id: params?.id },
      include: {
        assignedTo: { select: analystSelect },
        notes: {
          include: { author: { select: analystSelect } },
          orderBy: { createdAt: 'desc' },
        },
        statusHistory: {
          include: { changedBy: { select: analystSelect } },
          orderBy: { createdAt: 'desc' },
        },
        jiraTickets: {
          where: orgId ? { organizationId: orgId } : undefined,
          orderBy: { createdAt: 'desc' },
        },
        assetLinks: {
          where: orgId ? { asset: { organizationId: orgId } } : undefined,
          include: { asset: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!threat) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // VIEWERs never see internal analyst notes.
    const notes =
      ctx.role === 'VIEWER' ? threat.notes.filter((n) => !n.isInternal) : threat.notes;
    return NextResponse.json({ threat: { ...threat, notes } });
  } catch (error: any) {
    console.error('GET threat error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await getTenantContext(req);
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasPermission(ctx, 'threats.manage')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    // Threat status/severity is shared across all orgs (global catalog).
    const existing = await prisma.threat.findUnique({ where: { id: params?.id } });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const body = await req.json();
    const {
      status,
      severity,
      title,
      description,
      affectedAssets,
      assignedToId,
      dueDate,
      tags,
      statusNote,
    } = body ?? {};

    // Validate status if provided.
    if (status !== undefined && !isValidStatus(status)) {
      return NextResponse.json({ error: `Invalid status: ${status}` }, { status: 400 });
    }

    // Validate assignee (same org) if provided.
    let assignedToUpdate: { assignedToId: string | null } | {} = {};
    if (assignedToId !== undefined) {
      const normalized = assignedToId === null || assignedToId === '' ? null : String(assignedToId);
      if (normalized) {
        const assignee = await prisma.user.findUnique({
          where: { id: normalized },
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
      assignedToUpdate = { assignedToId: normalized };
    }

    let normalizedTags: string[] | undefined;
    if (tags !== undefined) {
      if (!Array.isArray(tags)) {
        return NextResponse.json({ error: 'tags must be an array' }, { status: 400 });
      }
      normalizedTags = tags.map((t: any) => String(t).trim()).filter(Boolean);
    }

    let dueDateUpdate: { dueDate: Date | null } | {} = {};
    if (dueDate !== undefined) {
      dueDateUpdate = { dueDate: dueDate ? new Date(dueDate) : null };
    }

    const statusChanged = status !== undefined && status !== existing.status;

    const threat = await prisma.$transaction(async (tx) => {
      const updated = await tx.threat.update({
        where: { id: params?.id },
        data: {
          ...(status !== undefined ? { status } : {}),
          ...(severity !== undefined ? { severity } : {}),
          ...(title !== undefined ? { title } : {}),
          ...(description !== undefined ? { description } : {}),
          ...(affectedAssets !== undefined ? { affectedAssets } : {}),
          ...(normalizedTags !== undefined ? { tags: normalizedTags } : {}),
          ...assignedToUpdate,
          ...dueDateUpdate,
        },
        include: {
          assignedTo: { select: analystSelect },
          notes: {
            include: { author: { select: analystSelect } },
            orderBy: { createdAt: 'desc' },
          },
          statusHistory: {
            include: { changedBy: { select: analystSelect } },
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      // Record status transition history.
      if (statusChanged && ctx.userId) {
        await tx.threatStatusHistory.create({
          data: {
            threatId: params!.id,
            changedById: ctx.userId,
            fromStatus: existing.status,
            toStatus: status,
            note: statusNote ? String(statusNote).trim() || null : null,
          },
        });
      }

      return updated;
    });

    if (statusChanged) {
      await writeAuditEvent({
        action: 'threat.status.changed',
        ctx,
        targetType: 'threat',
        targetId: params!.id,
        metadata: { fromStatus: existing.status, toStatus: status, note: statusNote ?? null },
      });
    }
    if (assignedToId !== undefined) {
      const normalized = assignedToId === null || assignedToId === '' ? null : String(assignedToId);
      await writeAuditEvent({
        action: normalized ? 'threat.assigned' : 'threat.unassigned',
        ctx,
        targetType: 'threat',
        targetId: params!.id,
        metadata: { previousAssigneeId: existing.assignedToId, assignedToId: normalized },
      });
    }

    // Re-fetch with fresh status history if it changed.
    if (statusChanged) {
      const refreshed = await prisma.threat.findUnique({
        where: { id: params?.id },
        include: {
          assignedTo: { select: analystSelect },
          notes: {
            include: { author: { select: analystSelect } },
            orderBy: { createdAt: 'desc' },
          },
          statusHistory: {
            include: { changedBy: { select: analystSelect } },
            orderBy: { createdAt: 'desc' },
          },
        },
      });
      return NextResponse.json({ threat: refreshed });
    }

    return NextResponse.json({ threat });
  } catch (error: any) {
    console.error('PATCH threat error:', error);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await getTenantContext(req);
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdmin(ctx)) return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    const existing = await prisma.threat.findUnique({ where: { id: params?.id } });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    await prisma.threat.delete({ where: { id: params?.id } });
    await writeAuditEvent({
      action: 'threat.deleted',
      ctx,
      targetType: 'threat',
      targetId: params!.id,
      metadata: { threatId: existing.threatId, title: existing.title },
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('DELETE threat error:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
