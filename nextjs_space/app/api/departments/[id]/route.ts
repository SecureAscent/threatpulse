export const dynamic = 'force-dynamic';

import { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { writeAuditEvent } from '@/lib/audit';
import { managedDepartmentScope, validateDepartmentInput } from '@/lib/department-admin';
import { getTenantContext, hasPermission } from '@/lib/tenant-context';

async function findManagedDepartment(id: string, context: NonNullable<Awaited<ReturnType<typeof getTenantContext>>>) {
  return prisma.department.findFirst({
    where: { AND: [{ id }, managedDepartmentScope(context)] },
    select: {
      id: true,
      organizationId: true,
      name: true,
      slug: true,
      createdAt: true,
      updatedAt: true,
      organization: { select: { name: true } },
      _count: { select: { users: true, assets: true, threats: true } },
    },
  });
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const context = await getTenantContext();
  if (!context) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasPermission(context, 'organizations.manage')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const existing = await findManagedDepartment(params.id, context);
  if (!existing) return NextResponse.json({ error: 'Department not found' }, { status: 404 });

  try {
    const body = await request.json();
    const input = validateDepartmentInput({
      name: body?.name ?? existing.name,
      slug: body?.slug ?? existing.slug,
    });
    const department = await prisma.department.update({
      where: { id: existing.id },
      data: input,
      select: { id: true, organizationId: true, name: true, slug: true, createdAt: true, updatedAt: true },
    });

    await writeAuditEvent({
      context,
      action: 'department.updated',
      entityType: 'Department',
      entityId: department.id,
      departmentId: department.id,
      metadata: {
        organizationId: department.organizationId,
        before: { name: existing.name, slug: existing.slug },
        after: { name: department.name, slug: department.slug },
      },
    });

    return NextResponse.json({ department });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: 'A department with that slug already exists in this organization.' }, { status: 409 });
    }
    const message = error instanceof Error ? error.message : 'Unable to update department.';
    const status = message.startsWith('Department ') ? 400 : 500;
    console.error('PATCH department error:', error);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const context = await getTenantContext();
  if (!context) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasPermission(context, 'organizations.manage')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const existing = await findManagedDepartment(params.id, context);
  if (!existing) return NextResponse.json({ error: 'Department not found' }, { status: 404 });

  const linkedRecords = existing._count.users + existing._count.assets + existing._count.threats;
  if (linkedRecords > 0) {
    return NextResponse.json(
      {
        error: `Department cannot be deleted while it has ${existing._count.users} users, ${existing._count.assets} assets, or ${existing._count.threats} threats assigned. Reassign them first.`,
      },
      { status: 409 },
    );
  }

  await prisma.department.delete({ where: { id: existing.id } });
  await writeAuditEvent({
    context,
    action: 'department.deleted',
    entityType: 'Department',
    entityId: existing.id,
    departmentId: existing.id,
    metadata: { organizationId: existing.organizationId, organizationName: existing.organization.name, name: existing.name, slug: existing.slug },
  });

  return NextResponse.json({ deleted: true });
}
