export const dynamic = 'force-dynamic';

import { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { writeAuditEvent } from '@/lib/audit';
import { organizationScope, validateOrganizationInput } from '@/lib/organization-admin';
import { getTenantContext, hasPermission } from '@/lib/tenant-context';

async function findManagedOrganization(id: string, context: Awaited<ReturnType<typeof getTenantContext>>) {
  if (!context) return null;
  return prisma.organization.findFirst({
    where: { AND: [{ id }, organizationScope(context)] },
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
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const context = await getTenantContext();
  if (!context) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasPermission(context, 'organizations.manage')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const organization = await findManagedOrganization(params.id, context);
  if (!organization) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
  }

  return NextResponse.json({ organization });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const context = await getTenantContext();
  if (!context) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasPermission(context, 'organizations.manage')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const existing = await findManagedOrganization(params.id, context);
  if (!existing) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
  }

  try {
    const body = await request.json();
    const input = validateOrganizationInput({
      name: body?.name ?? existing.name,
      slug: body?.slug ?? existing.slug,
      timezone: body?.timezone ?? existing.timezone,
    });
    const description = body?.description === undefined
      ? existing.description
      : String(body.description || '').trim() || null;

    const organization = await prisma.organization.update({
      where: { id: existing.id },
      data: { ...input, description },
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
      action: 'organization.updated',
      entityType: 'Organization',
      entityId: organization.id,
      metadata: {
        before: {
          name: existing.name,
          slug: existing.slug,
          description: existing.description,
          timezone: existing.timezone,
        },
        after: {
          name: organization.name,
          slug: organization.slug,
          description: organization.description,
          timezone: organization.timezone,
        },
      },
    });

    return NextResponse.json({ organization });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: 'An organization with that slug already exists.' }, { status: 409 });
    }
    const message = error instanceof Error ? error.message : 'Unable to update organization.';
    const status = message.startsWith('Organization ') || message.startsWith('Timezone ') ? 400 : 500;
    console.error('PATCH organization error:', error);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const context = await getTenantContext();
  if (!context) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasPermission(context, 'organizations.manage')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const existing = await findManagedOrganization(params.id, context);
  if (!existing) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
  }
  if (existing.archivedAt) {
    return NextResponse.json({ organization: existing });
  }
  if (existing.id === context.organizationId && context.role !== 'SUPERADMIN') {
    return NextResponse.json(
      { error: 'You cannot archive the organization for your active session.' },
      { status: 409 },
    );
  }

  const organization = await prisma.organization.update({
    where: { id: existing.id },
    data: { archivedAt: new Date() },
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
    action: 'organization.archived',
    entityType: 'Organization',
    entityId: organization.id,
    metadata: { name: organization.name, slug: organization.slug },
  });

  return NextResponse.json({ organization });
}
