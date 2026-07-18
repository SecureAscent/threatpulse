import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

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

async function uniqueParentSlug(name: string) {
  const base = slugify(name, 'parent');
  let candidate = base;
  let suffix = 2;
  while (await prisma.parentOrganization.findUnique({ where: { slug: candidate }, select: { id: true } })) {
    const tail = `-${suffix++}`;
    candidate = `${base.slice(0, 64 - tail.length).replace(/-+$/g, '')}${tail}`;
  }
  return candidate;
}

async function uniqueOrganizationSlug(name: string) {
  const base = slugify(name, 'organization');
  let candidate = base;
  let suffix = 2;
  while (await prisma.organization.findUnique({ where: { slug: candidate }, select: { id: true } })) {
    const tail = `-${suffix++}`;
    candidate = `${base.slice(0, 64 - tail.length).replace(/-+$/g, '')}${tail}`;
  }
  return candidate;
}

async function uniqueDepartmentSlug(organizationId: string, name: string) {
  const base = slugify(name, 'department');
  let candidate = base;
  let suffix = 2;
  while (await prisma.department.findFirst({ where: { organizationId, slug: candidate }, select: { id: true } })) {
    const tail = `-${suffix++}`;
    candidate = `${base.slice(0, 64 - tail.length).replace(/-+$/g, '')}${tail}`;
  }
  return candidate;
}

const hierarchySelect = {
  id: true,
  name: true,
  slug: true,
  createdAt: true,
  organizations: {
    select: {
      id: true,
      name: true,
      slug: true,
      parentOrganizationId: true,
      createdAt: true,
      departments: {
        select: {
          id: true,
          name: true,
          slug: true,
          organizationId: true,
          _count: { select: { users: true, threats: true } },
        },
        orderBy: { name: 'asc' as const },
      },
      _count: { select: { users: true, threats: true, departments: true } },
    },
    orderBy: { name: 'asc' as const },
  },
} as const;

export async function GET() {
  try {
    const admin = await getAdminUser();
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (admin.role === 'SUPERADMIN') {
      const parents = await prisma.parentOrganization.findMany({
        select: hierarchySelect,
        orderBy: { name: 'asc' },
      });
      const unassignedOrganizations = await prisma.organization.findMany({
        where: { parentOrganizationId: null },
        select: {
          id: true,
          name: true,
          slug: true,
          parentOrganizationId: true,
          createdAt: true,
          departments: {
            select: {
              id: true,
              name: true,
              slug: true,
              organizationId: true,
              _count: { select: { users: true, threats: true } },
            },
            orderBy: { name: 'asc' },
          },
          _count: { select: { users: true, threats: true, departments: true } },
        },
        orderBy: { name: 'asc' },
      });
      const organizations = [...parents.flatMap((parent) => parent.organizations), ...unassignedOrganizations];
      return NextResponse.json({ parents, unassignedOrganizations, organizations });
    }

    if (!admin.organizationId) {
      return NextResponse.json({ parents: [], unassignedOrganizations: [], organizations: [] });
    }
    const organization = await prisma.organization.findUnique({
      where: { id: admin.organizationId },
      select: {
        id: true,
        name: true,
        slug: true,
        parentOrganizationId: true,
        parentOrganization: { select: { id: true, name: true, slug: true } },
        departments: {
          select: {
            id: true,
            name: true,
            slug: true,
            organizationId: true,
            _count: { select: { users: true, threats: true } },
          },
          orderBy: { name: 'asc' },
        },
        _count: { select: { users: true, threats: true, departments: true } },
      },
    });
    return NextResponse.json({ organization, organizations: organization ? [organization] : [] });
  } catch (error) {
    console.error('[ORGS_GET_ERROR]', error);
    return NextResponse.json({ error: 'Failed to load organization hierarchy' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const admin = await getAdminUser();
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { action, name, parentOrganizationId, organizationId, departmentId, userId } = body ?? {};
    const normalizedName = typeof name === 'string' ? name.trim() : '';

    if (action === 'createParent') {
      if (admin.role !== 'SUPERADMIN') return NextResponse.json({ error: 'Super administrator access required' }, { status: 403 });
      if (!normalizedName) return NextResponse.json({ error: 'Parent organization name is required' }, { status: 400 });
      const parent = await prisma.parentOrganization.create({
        data: { name: normalizedName, slug: await uniqueParentSlug(normalizedName) },
        select: hierarchySelect,
      });
      return NextResponse.json({ parent }, { status: 201 });
    }

    if (action === 'createOrg') {
      if (admin.role !== 'SUPERADMIN') return NextResponse.json({ error: 'Super administrator access required' }, { status: 403 });
      if (!normalizedName) return NextResponse.json({ error: 'Organization name is required' }, { status: 400 });
      if (!parentOrganizationId) return NextResponse.json({ error: 'Parent organization is required' }, { status: 400 });
      const parent = await prisma.parentOrganization.findUnique({ where: { id: parentOrganizationId }, select: { id: true } });
      if (!parent) return NextResponse.json({ error: 'Parent organization not found' }, { status: 404 });
      const organization = await prisma.organization.create({
        data: {
          name: normalizedName,
          slug: await uniqueOrganizationSlug(normalizedName),
          parentOrganizationId,
          departments: { create: { name: 'General', slug: 'general' } },
        },
        select: {
          id: true,
          name: true,
          slug: true,
          parentOrganizationId: true,
          createdAt: true,
          departments: { select: { id: true, name: true, slug: true, organizationId: true, _count: { select: { users: true, threats: true } } } },
          _count: { select: { users: true, threats: true, departments: true } },
        },
      });
      return NextResponse.json({ organization }, { status: 201 });
    }

    if (action === 'createDepartment') {
      if (!normalizedName) return NextResponse.json({ error: 'Department name is required' }, { status: 400 });
      const targetOrganizationId = admin.role === 'SUPERADMIN' ? organizationId : admin.organizationId;
      if (!targetOrganizationId) return NextResponse.json({ error: 'Organization is required' }, { status: 400 });
      const organization = await prisma.organization.findUnique({ where: { id: targetOrganizationId }, select: { id: true } });
      if (!organization) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
      const department = await prisma.department.create({
        data: {
          organizationId: targetOrganizationId,
          name: normalizedName,
          slug: await uniqueDepartmentSlug(targetOrganizationId, normalizedName),
        },
        select: { id: true, name: true, slug: true, organizationId: true, _count: { select: { users: true, threats: true } } },
      });
      return NextResponse.json({ department }, { status: 201 });
    }

    if (action === 'assignUser') {
      if (admin.role !== 'SUPERADMIN') return NextResponse.json({ error: 'Only super administrators can reassign users' }, { status: 403 });
      if (!userId || !organizationId) return NextResponse.json({ error: 'userId and organizationId are required' }, { status: 400 });
      const organization = await prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true } });
      if (!organization) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
      if (departmentId) {
        const department = await prisma.department.findFirst({ where: { id: departmentId, organizationId }, select: { id: true } });
        if (!department) return NextResponse.json({ error: 'Department does not belong to the selected organization' }, { status: 400 });
      }
      const user = await prisma.user.update({
        where: { id: userId },
        data: { organizationId, departmentId: departmentId || null },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          organizationId: true,
          departmentId: true,
          organization: { select: { id: true, name: true, slug: true } },
          department: { select: { id: true, name: true, slug: true } },
        },
      });
      return NextResponse.json({ user });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('[ORGS_POST_ERROR]', error);
    return NextResponse.json({ error: 'Operation failed' }, { status: 500 });
  }
}
