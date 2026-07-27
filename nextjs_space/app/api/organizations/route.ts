export const dynamic = 'force-dynamic';

import { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { writeAuditEvent } from '@/lib/audit';
import {
  canCreateOrganization,
  organizationScope,
  parentOrganizationForCreate,
  validateOrganizationInput,
} from '@/lib/organization-admin';
import { getTenantContext, hasPermission } from '@/lib/tenant-context';

function parsePage(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export async function GET(request: NextRequest) {
  const context = await getTenantContext();
  if (!context) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasPermission(context, 'organizations.manage')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = request.nextUrl;
  const page = parsePage(searchParams.get('page'), 1);
  const pageSize = Math.min(parsePage(searchParams.get('pageSize'), 25), 100);
  const search = String(searchParams.get('search') || '').trim();
  const includeArchived = searchParams.get('includeArchived') === 'true';

  const where: Prisma.OrganizationWhereInput = {
    AND: [
      organizationScope(context),
      includeArchived ? {} : { archivedAt: null },
      search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { slug: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {},
    ],
  };

  const [organizations, total] = await prisma.$transaction([
    prisma.organization.findMany({
      where,
      orderBy: [{ archivedAt: 'asc' }, { name: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        parentOrganizationId: true,
        name: true,
        slug: true,
        description: true,
        timezone: true,
        archivedAt: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { users: true, departments: true, assets: true, threats: true } },
      },
    }),
    prisma.organization.count({ where }),
  ]);

  return NextResponse.json({ organizations, page, pageSize, total });
}

export async function POST(request: NextRequest) {
  const context = await getTenantContext();
  if (!context) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasPermission(context, 'organizations.manage') || !canCreateOrganization(context)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const input = validateOrganizationInput(body || {});
    const description = String(body?.description || '').trim() || null;
    const parentOrganizationId = parentOrganizationForCreate(
      context,
      body?.parentOrganizationId,
    );

    if (parentOrganizationId) {
      const parent = await prisma.parentOrganization.findFirst({
        where: { id: parentOrganizationId, archivedAt: null },
        select: { id: true },
      });
      if (!parent) {
        return NextResponse.json(
          { error: 'Parent organization not found or archived.' },
          { status: 400 },
        );
      }
    }

    const organization = await prisma.organization.create({
      data: { ...input, description, parentOrganizationId },
      select: {
        id: true,
        parentOrganizationId: true,
        name: true,
        slug: true,
        description: true,
        timezone: true,
        archivedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await writeAuditEvent({
      context,
      action: 'organization.created',
      entityType: 'Organization',
      entityId: organization.id,
      metadata: {
        name: organization.name,
        slug: organization.slug,
        parentOrganizationId: organization.parentOrganizationId,
      },
    });

    return NextResponse.json({ organization }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: 'An organization with that slug already exists.' }, { status: 409 });
    }
    const message = error instanceof Error ? error.message : 'Unable to create organization.';
    const status = message.startsWith('Organization ') || message.startsWith('Timezone ') ? 400 : 500;
    console.error('POST organizations error:', error);
    return NextResponse.json({ error: message }, { status });
  }
}
