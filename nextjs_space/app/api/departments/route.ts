export const dynamic = 'force-dynamic';

import { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { writeAuditEvent } from '@/lib/audit';
import { managedDepartmentScope, validateDepartmentInput } from '@/lib/department-admin';
import { organizationScope } from '@/lib/organization-admin';
import { getTenantContext, hasPermission } from '@/lib/tenant-context';

export async function GET(request: NextRequest) {
  const context = await getTenantContext();
  if (!context) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasPermission(context, 'organizations.manage')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const organizationId = String(request.nextUrl.searchParams.get('organizationId') || '').trim();
  const search = String(request.nextUrl.searchParams.get('search') || '').trim();
  const where: Prisma.DepartmentWhereInput = {
    AND: [
      managedDepartmentScope(context),
      organizationId ? { organizationId } : {},
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

  const departments = await prisma.department.findMany({
    where,
    orderBy: [{ organization: { name: 'asc' } }, { name: 'asc' }],
    select: {
      id: true,
      organizationId: true,
      name: true,
      slug: true,
      createdAt: true,
      updatedAt: true,
      organization: { select: { id: true, name: true, slug: true } },
      _count: { select: { users: true, assets: true, threats: true } },
    },
  });

  return NextResponse.json({ departments });
}

export async function POST(request: NextRequest) {
  const context = await getTenantContext();
  if (!context) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasPermission(context, 'organizations.manage')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const organizationId = String(body?.organizationId || '').trim();
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization is required.' }, { status: 400 });
    }

    const organization = await prisma.organization.findFirst({
      where: { AND: [{ id: organizationId, archivedAt: null }, organizationScope(context)] },
      select: { id: true, name: true },
    });
    if (!organization) {
      return NextResponse.json({ error: 'Organization not found or unavailable.' }, { status: 404 });
    }

    const input = validateDepartmentInput(body || {});
    const department = await prisma.department.create({
      data: { organizationId, ...input },
      select: {
        id: true,
        organizationId: true,
        name: true,
        slug: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await writeAuditEvent({
      context,
      action: 'department.created',
      entityType: 'Department',
      entityId: department.id,
      departmentId: department.id,
      metadata: { organizationId, organizationName: organization.name, name: department.name, slug: department.slug },
    });

    return NextResponse.json({ department }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: 'A department with that slug already exists in this organization.' }, { status: 409 });
    }
    const message = error instanceof Error ? error.message : 'Unable to create department.';
    const status = message.startsWith('Department ') ? 400 : 500;
    console.error('POST departments error:', error);
    return NextResponse.json({ error: message }, { status });
  }
}
