import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { writeAuditEvent } from '@/lib/audit';
import { normalizeAppRole } from '@/lib/rbac';

type AdminSessionUser = {
  id: string;
  role: string;
  organizationId: string | null;
};

async function getAdminUser(): Promise<AdminSessionUser | null> {
  const session = await getServerSession(authOptions);
  const user = session?.user as AdminSessionUser | undefined;
  if (!user || !['ADMIN', 'SUPERADMIN'].includes(user.role)) return null;
  return user;
}

function slugify(name: string, fallback: string): string {
  const slug = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
    .replace(/-+$/g, '');
  return slug || fallback;
}

async function uniqueOrganizationSlug(name: string, excludeId: string) {
  const base = slugify(name, 'organization');
  let candidate = base;
  let suffix = 2;

  while (
    await prisma.organization.findFirst({
      where: { slug: candidate, id: { not: excludeId } },
      select: { id: true },
    })
  ) {
    const tail = `-${suffix++}`;
    candidate = `${base.slice(0, 64 - tail.length).replace(/-+$/g, '')}${tail}`;
  }

  return candidate;
}

function auditContext(admin: AdminSessionUser, organizationId: string) {
  return {
    userId: admin.id,
    role: normalizeAppRole(admin.role),
    organizationId,
    departmentId: null,
    parentOrganizationId: null,
  };
}

export async function PATCH(request: Request) {
  try {
    const admin = await getAdminUser();
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { action, organizationId, name, parentOrganizationId } = body ?? {};

    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId is required' }, { status: 400 });
    }

    if (admin.role !== 'SUPERADMIN' && admin.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const existing = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        name: true,
        slug: true,
        archivedAt: true,
        parentOrganizationId: true,
        _count: { select: { users: true, threats: true, departments: true } },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    if (action === 'rename') {
      const normalizedName = typeof name === 'string' ? name.trim() : '';
      if (!normalizedName) {
        return NextResponse.json({ error: 'Organization name is required' }, { status: 400 });
      }

      const organization = await prisma.organization.update({
        where: { id: organizationId },
        data: {
          name: normalizedName,
          slug: await uniqueOrganizationSlug(normalizedName, organizationId),
        },
        select: {
          id: true,
          name: true,
          slug: true,
          archivedAt: true,
          parentOrganizationId: true,
          updatedAt: true,
        },
      });

      await writeAuditEvent({
        context: auditContext(admin, organizationId),
        action: 'organization.rename',
        entityType: 'Organization',
        entityId: organizationId,
        metadata: {
          before: { name: existing.name, slug: existing.slug },
          after: { name: organization.name, slug: organization.slug },
        },
      });

      return NextResponse.json({ organization });
    }

    if (action === 'archive') {
      if (existing.archivedAt) {
        return NextResponse.json({ error: 'Organization is already archived' }, { status: 409 });
      }

      if (admin.role !== 'SUPERADMIN') {
        return NextResponse.json({ error: 'Only super administrators can archive organizations' }, { status: 403 });
      }

      const archivedAt = new Date();
      const organization = await prisma.organization.update({
        where: { id: organizationId },
        data: { archivedAt },
        select: { id: true, name: true, slug: true, archivedAt: true, parentOrganizationId: true },
      });

      await writeAuditEvent({
        context: auditContext(admin, organizationId),
        action: 'organization.archive',
        entityType: 'Organization',
        entityId: organizationId,
        metadata: {
          archivedAt: archivedAt.toISOString(),
          dependentCounts: existing._count,
        },
      });

      return NextResponse.json({ organization });
    }

    if (action === 'restore') {
      if (!existing.archivedAt) {
        return NextResponse.json({ error: 'Organization is not archived' }, { status: 409 });
      }

      if (admin.role !== 'SUPERADMIN') {
        return NextResponse.json({ error: 'Only super administrators can restore organizations' }, { status: 403 });
      }

      const organization = await prisma.organization.update({
        where: { id: organizationId },
        data: { archivedAt: null },
        select: { id: true, name: true, slug: true, archivedAt: true, parentOrganizationId: true },
      });

      await writeAuditEvent({
        context: auditContext(admin, organizationId),
        action: 'organization.restore',
        entityType: 'Organization',
        entityId: organizationId,
        metadata: { previousArchivedAt: existing.archivedAt.toISOString() },
      });

      return NextResponse.json({ organization });
    }

    if (action === 'move') {
      if (admin.role !== 'SUPERADMIN') {
        return NextResponse.json({ error: 'Only super administrators can move organizations' }, { status: 403 });
      }

      if (parentOrganizationId) {
        const parent = await prisma.parentOrganization.findUnique({
          where: { id: parentOrganizationId },
          select: { id: true, name: true },
        });
        if (!parent) {
          return NextResponse.json({ error: 'Parent organization not found' }, { status: 404 });
        }
      }

      const organization = await prisma.organization.update({
        where: { id: organizationId },
        data: { parentOrganizationId: parentOrganizationId || null },
        select: { id: true, name: true, slug: true, archivedAt: true, parentOrganizationId: true },
      });

      await writeAuditEvent({
        context: auditContext(admin, organizationId),
        action: 'organization.move',
        entityType: 'Organization',
        entityId: organizationId,
        metadata: {
          before: { parentOrganizationId: existing.parentOrganizationId },
          after: { parentOrganizationId: organization.parentOrganizationId },
        },
      });

      return NextResponse.json({ organization });
    }

    return NextResponse.json({ error: 'Invalid lifecycle action' }, { status: 400 });
  } catch (error) {
    console.error('[ORG_LIFECYCLE_PATCH_ERROR]', error);
    return NextResponse.json({ error: 'Organization lifecycle operation failed' }, { status: 500 });
  }
}
