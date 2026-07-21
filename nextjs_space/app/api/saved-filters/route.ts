export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getTenantContext, hasPermission } from '@/lib/tenant-context';
import { writeAuditEvent } from '@/lib/audit';

// GET /api/saved-filters — the caller's own filters plus filters shared with
// the organization.
export async function GET(req: NextRequest) {
  try {
    const ctx = await getTenantContext(req);
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasPermission(ctx, 'threats.read')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (!ctx.userId || !ctx.organizationId) return NextResponse.json({ savedFilters: [] });

    const savedFilters = await prisma.savedFilter.findMany({
      where: {
        organizationId: ctx.organizationId,
        OR: [{ userId: ctx.userId }, { isShared: true }],
      },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ savedFilters });
  } catch (error: any) {
    console.error('GET saved-filters error:', error);
    return NextResponse.json({ error: 'Failed to fetch saved filters' }, { status: 500 });
  }
}

// POST /api/saved-filters — create a saved filter.
// Body: { name: string, filters: object, isShared?: boolean }
export async function POST(req: NextRequest) {
  try {
    const ctx = await getTenantContext(req);
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasPermission(ctx, 'threats.read')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (!ctx.userId || !ctx.organizationId) {
      return NextResponse.json({ error: 'A user session is required' }, { status: 403 });
    }

    const body = await req.json();
    const name = (body?.name ?? '').toString().trim();
    const filters = body?.filters ?? {};
    const isShared = Boolean(body?.isShared);
    if (!name) return NextResponse.json({ error: 'Filter name is required' }, { status: 400 });

    const saved = await prisma.savedFilter.create({
      data: {
        userId: ctx.userId,
        organizationId: ctx.organizationId,
        name,
        filters,
        isShared,
      },
    });

    await writeAuditEvent({
      action: 'threat.filter.saved',
      ctx,
      targetType: 'savedFilter',
      targetId: saved.id,
      metadata: { name, isShared },
    });

    return NextResponse.json({ savedFilter: saved }, { status: 201 });
  } catch (error: any) {
    console.error('POST saved-filters error:', error);
    return NextResponse.json({ error: 'Failed to create saved filter' }, { status: 500 });
  }
}
