export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { writeAuditEvent } from '@/lib/audit';
import {
  buildThreatScope,
  getTenantContext,
  hasPermission,
} from '@/lib/tenant-context';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const context = await getTenantContext();
    if (!context) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasPermission(context, 'threats.read')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const threat = await prisma.threat.findFirst({
      where: { id: params?.id, ...buildThreatScope(context) },
    });
    if (!threat) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ threat });
  } catch (error) {
    console.error('GET threat error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const context = await getTenantContext();
    if (!context) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasPermission(context, 'threats.update')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const existing = await prisma.threat.findFirst({
      where: { id: params?.id, ...buildThreatScope(context) },
      select: {
        id: true,
        threatId: true,
        departmentId: true,
        status: true,
        severity: true,
      },
    });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const body = await req.json();
    const { status, severity, description, affectedAssets } = body ?? {};
    const threat = await prisma.threat.update({
      where: { id: existing.id },
      data: {
        ...(status ? { status } : {}),
        ...(severity ? { severity } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(affectedAssets !== undefined ? { affectedAssets } : {}),
      },
    });

    const changedFields = [
      status !== undefined ? 'status' : null,
      severity !== undefined ? 'severity' : null,
      description !== undefined ? 'description' : null,
      affectedAssets !== undefined ? 'affectedAssets' : null,
    ].filter((field): field is string => Boolean(field));

    await writeAuditEvent({
      context,
      action: 'threat.updated',
      entityType: 'Threat',
      entityId: threat.id,
      departmentId: threat.departmentId,
      metadata: {
        threatId: threat.threatId,
        changedFields,
        previousStatus: existing.status,
        newStatus: threat.status,
        previousSeverity: existing.severity,
        newSeverity: threat.severity,
      },
    });

    return NextResponse.json({ threat });
  } catch (error) {
    console.error('PATCH threat error:', error);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const context = await getTenantContext();
    if (!context) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasPermission(context, 'threats.delete')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const existing = await prisma.threat.findFirst({
      where: { id: params?.id, ...buildThreatScope(context) },
      select: { id: true, threatId: true, departmentId: true, severity: true, type: true },
    });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await prisma.threat.delete({ where: { id: existing.id } });
    await writeAuditEvent({
      context,
      action: 'threat.deleted',
      entityType: 'Threat',
      entityId: existing.id,
      departmentId: existing.departmentId,
      metadata: {
        threatId: existing.threatId,
        severity: existing.severity,
        type: existing.type,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE threat error:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
