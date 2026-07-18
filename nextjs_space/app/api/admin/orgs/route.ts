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

  if (!user || !['ADMIN', 'SUPERADMIN'].includes(user.role)) {
    return null;
  }

  return user;
}

function slugifyOrganizationName(name: string): string {
  const slug = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
    .replace(/-+$/g, '');

  return slug || 'organization';
}

async function generateUniqueSlug(name: string): Promise<string> {
  const baseSlug = slugifyOrganizationName(name);
  let candidate = baseSlug;
  let suffix = 2;

  while (await prisma.organization.findUnique({ where: { slug: candidate }, select: { id: true } })) {
    const suffixText = `-${suffix}`;
    candidate = `${baseSlug.slice(0, 64 - suffixText.length).replace(/-+$/g, '')}${suffixText}`;
    suffix += 1;
  }

  return candidate;
}

export async function GET() {
  try {
    const admin = await getAdminUser();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const organizations = await prisma.organization.findMany({
      where: admin.role === 'SUPERADMIN'
        ? undefined
        : { id: admin.organizationId ?? '__missing__' },
      select: {
        id: true,
        name: true,
        slug: true,
        createdAt: true,
        _count: {
          select: { users: true, threats: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ organizations });
  } catch (error: unknown) {
    console.error('[ORGS_GET_ERROR]', error);
    return NextResponse.json({ error: 'Failed to load organizations' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const admin = await getAdminUser();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, name, userId, orgId } = body ?? {};

    if (action === 'createOrg') {
      if (admin.role !== 'SUPERADMIN') {
        return NextResponse.json({ error: 'Super administrator access required' }, { status: 403 });
      }

      const normalizedName = typeof name === 'string' ? name.trim() : '';
      if (!normalizedName) {
        return NextResponse.json({ error: 'Organization name is required' }, { status: 400 });
      }

      if (normalizedName.length > 120) {
        return NextResponse.json({ error: 'Organization name must be 120 characters or fewer' }, { status: 400 });
      }

      const slug = await generateUniqueSlug(normalizedName);
      const organization = await prisma.organization.create({
        data: { name: normalizedName, slug },
        select: {
          id: true,
          name: true,
          slug: true,
          createdAt: true,
          _count: { select: { users: true, threats: true } },
        },
      });

      return NextResponse.json({ organization }, { status: 201 });
    }

    if (action === 'assignUser') {
      if (!userId || !orgId) {
        return NextResponse.json({ error: 'userId and orgId are required' }, { status: 400 });
      }

      if (admin.role !== 'SUPERADMIN') {
        return NextResponse.json({ error: 'Only super administrators can reassign users' }, { status: 403 });
      }

      const [user, organization] = await Promise.all([
        prisma.user.findUnique({ where: { id: userId }, select: { id: true } }),
        prisma.organization.findUnique({ where: { id: orgId }, select: { id: true } }),
      ]);

      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      if (!organization) {
        return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
      }

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { organizationId: orgId },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          organizationId: true,
          organization: { select: { id: true, name: true, slug: true } },
        },
      });

      return NextResponse.json({ user: updatedUser });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: unknown) {
    console.error('[ORGS_POST_ERROR]', error);
    return NextResponse.json({ error: 'Operation failed' }, { status: 500 });
  }
}
