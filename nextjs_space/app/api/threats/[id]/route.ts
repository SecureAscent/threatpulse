export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
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
      select: { id: true },
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
      select: { id: true },
    });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await prisma.threat.delete({ where: { id: existing.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE threat error:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
