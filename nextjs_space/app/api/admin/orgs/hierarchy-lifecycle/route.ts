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

type ParentRow = {
  id: string;
  name: string;
  slug: string;
  archivedAt: Date | null;
};

type DepartmentRow = {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  archivedAt: Date | null;
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

async function uniqueParentSlug(name: string, excludeId: string) {
  const base = slugify(name, 'parent');
  let candidate = base;
  let suffix = 2;
  while (await prisma.parentOrganization.findFirst({ where: { slug: candidate, id: { not: excludeId } }, select: { id: true } })) {
    const tail = `-${suffix++}`;
    candidate = `${base.slice(0, 64 - tail.length).replace(/-+$/g, '')}${tail}`;
  }
  return candidate;
}

async function uniqueDepartmentSlug(organizationId: string, name: string, excludeId: string) {
  const base = slugify(name, 'department');
  let candidate = base;
  let suffix = 2;
  while (await prisma.department.findFirst({ where: { organizationId, slug: candidate, id: { not: excludeId } }, select: { id: true } })) {
    const tail = `-${suffix++}`;
    candidate = `${base.slice(0, 64 - tail.length).replace(/-+$/g, '')}${tail}`;
  }
  return candidate;
}

function auditContext(admin: AdminSessionUser, organizationId: string, departmentId?: string | null) {
  return {
    userId: admin.id,
    role: normalizeAppRole(admin.role),
    organizationId,
    departmentId: departmentId ?? null,
    parentOrganizationId: null,
  };
}

async function parentAuditOrganizationId(parentOrganizationId: string) {
  const organization = await prisma.organization.findFirst({
    where: { parentOrganizationId },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });
  return organization?.id ?? null;
}

export async function PATCH(request: Request) {
  try {
    const admin = await getAdminUser();
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { entityType, action, parentOrganizationId, departmentId, name } = body ?? {};

    if (entityType === 'parentOrganization') {
      if (admin.role !== 'SUPERADMIN') {
        return NextResponse.json({ error: 'Super administrator access required' }, { status: 403 });
      }
      if (!parentOrganizationId) {
        return NextResponse.json({ error: 'parentOrganizationId is required' }, { status: 400 });
      }

      const rows = await prisma.$queryRaw<ParentRow[]>`
        SELECT id, name, slug, "archivedAt"
        FROM "ParentOrganization"
        WHERE id = ${parentOrganizationId}
        LIMIT 1
      `;
      const existing = rows[0];
      if (!existing) return NextResponse.json({ error: 'Parent organization not found' }, { status: 404 });

      let updated: ParentRow;
      if (action === 'rename') {
        const normalizedName = typeof name === 'string' ? name.trim() : '';
        if (!normalizedName) return NextResponse.json({ error: 'Parent organization name is required' }, { status: 400 });
        const slug = await uniqueParentSlug(normalizedName, parentOrganizationId);
        [updated] = await prisma.$queryRaw<ParentRow[]>`
          UPDATE "ParentOrganization"
          SET name = ${normalizedName}, slug = ${slug}, "updatedAt" = NOW()
          WHERE id = ${parentOrganizationId}
          RETURNING id, name, slug, "archivedAt"
        `;
      } else if (action === 'archive') {
        if (existing.archivedAt) return NextResponse.json({ error: 'Parent organization is already archived' }, { status: 409 });
        [updated] = await prisma.$queryRaw<ParentRow[]>`
          UPDATE "ParentOrganization"
          SET "archivedAt" = NOW(), "updatedAt" = NOW()
          WHERE id = ${parentOrganizationId}
          RETURNING id, name, slug, "archivedAt"
        `;
      } else if (action === 'restore') {
        if (!existing.archivedAt) return NextResponse.json({ error: 'Parent organization is not archived' }, { status: 409 });
        [updated] = await prisma.$queryRaw<ParentRow[]>`
          UPDATE "ParentOrganization"
          SET "archivedAt" = NULL, "updatedAt" = NOW()
          WHERE id = ${parentOrganizationId}
          RETURNING id, name, slug, "archivedAt"
        `;
      } else {
        return NextResponse.json({ error: 'Invalid parent organization action' }, { status: 400 });
      }

      const organizationId = await parentAuditOrganizationId(parentOrganizationId);
      if (organizationId) {
        await writeAuditEvent({
          context: auditContext(admin, organizationId),
          action: `parentOrganization.${action}`,
          entityType: 'ParentOrganization',
          entityId: parentOrganizationId,
          metadata: {
            before: { name: existing.name, slug: existing.slug, archivedAt: existing.archivedAt },
            after: { name: updated.name, slug: updated.slug, archivedAt: updated.archivedAt },
          },
        });
      }

      return NextResponse.json({ parentOrganization: updated });
    }

    if (entityType === 'department') {
      if (!departmentId) return NextResponse.json({ error: 'departmentId is required' }, { status: 400 });

      const rows = await prisma.$queryRaw<DepartmentRow[]>`
        SELECT id, "organizationId", name, slug, "archivedAt"
        FROM "Department"
        WHERE id = ${departmentId}
        LIMIT 1
      `;
      const existing = rows[0];
      if (!existing) return NextResponse.json({ error: 'Department not found' }, { status: 404 });
      if (admin.role !== 'SUPERADMIN' && admin.organizationId !== existing.organizationId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      let updated: DepartmentRow;
      if (action === 'rename') {
        const normalizedName = typeof name === 'string' ? name.trim() : '';
        if (!normalizedName) return NextResponse.json({ error: 'Department name is required' }, { status: 400 });
        const slug = await uniqueDepartmentSlug(existing.organizationId, normalizedName, departmentId);
        [updated] = await prisma.$queryRaw<DepartmentRow[]>`
          UPDATE "Department"
          SET name = ${normalizedName}, slug = ${slug}, "updatedAt" = NOW()
          WHERE id = ${departmentId}
          RETURNING id, "organizationId", name, slug, "archivedAt"
        `;
      } else if (action === 'archive') {
        if (existing.archivedAt) return NextResponse.json({ error: 'Department is already archived' }, { status: 409 });
        [updated] = await prisma.$queryRaw<DepartmentRow[]>`
          UPDATE "Department"
          SET "archivedAt" = NOW(), "updatedAt" = NOW()
          WHERE id = ${departmentId}
          RETURNING id, "organizationId", name, slug, "archivedAt"
        `;
      } else if (action === 'restore') {
        if (!existing.archivedAt) return NextResponse.json({ error: 'Department is not archived' }, { status: 409 });
        [updated] = await prisma.$queryRaw<DepartmentRow[]>`
          UPDATE "Department"
          SET "archivedAt" = NULL, "updatedAt" = NOW()
          WHERE id = ${departmentId}
          RETURNING id, "organizationId", name, slug, "archivedAt"
        `;
      } else {
        return NextResponse.json({ error: 'Invalid department action' }, { status: 400 });
      }

      await writeAuditEvent({
        context: auditContext(admin, existing.organizationId, departmentId),
        action: `department.${action}`,
        entityType: 'Department',
        entityId: departmentId,
        departmentId,
        metadata: {
          before: { name: existing.name, slug: existing.slug, archivedAt: existing.archivedAt },
          after: { name: updated.name, slug: updated.slug, archivedAt: updated.archivedAt },
        },
      });

      return NextResponse.json({ department: updated });
    }

    return NextResponse.json({ error: 'Invalid entityType' }, { status: 400 });
  } catch (error) {
    console.error('[HIERARCHY_LIFECYCLE_PATCH_ERROR]', error);
    return NextResponse.json({ error: 'Hierarchy lifecycle operation failed' }, { status: 500 });
  }
}
