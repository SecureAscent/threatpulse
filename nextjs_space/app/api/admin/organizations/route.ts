export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

// Lists all organizations. SUPERADMIN only — powers the org picker used across
// the admin UI (user management, and the multi-org Organization Settings view).
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = session.user as any;
    if (user?.role !== 'SUPERADMIN') return NextResponse.json({ error: 'Superadmin only' }, { status: 403 });

    const organizations = await prisma.organization.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        createdAt: true,
        _count: { select: { users: true, threats: true } },
      },
      orderBy: { name: 'asc' },
    });
    return NextResponse.json({ organizations });
  } catch (error: any) {
    console.error('Admin organizations error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

// Creates a new organization. SUPERADMIN only.
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = session.user as any;
    if (user?.role !== 'SUPERADMIN') return NextResponse.json({ error: 'Superadmin only' }, { status: 403 });

    const body = await req.json();
    const name = String(body?.name ?? '').trim();
    if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 });

    const slug = slugify(body?.slug ? String(body.slug) : name);
    if (!slug) return NextResponse.json({ error: 'Invalid slug' }, { status: 400 });

    const clash = await prisma.organization.findUnique({ where: { slug }, select: { id: true } });
    if (clash) return NextResponse.json({ error: 'Slug already in use' }, { status: 409 });

    const department = body?.department ? String(body.department).trim() || null : null;

    let parentId: string | null = null;
    if (body?.parentId) {
      const parentOrg = await prisma.organization.findUnique({
        where: { id: String(body.parentId) },
        select: { id: true },
      });
      if (!parentOrg) return NextResponse.json({ error: 'Parent organization not found' }, { status: 404 });
      parentId = parentOrg.id;
    }

    const organization = await prisma.organization.create({
      data: { name, slug, department, parentId },
      select: {
        id: true,
        name: true,
        slug: true,
        department: true,
        parentId: true,
        createdAt: true,
        _count: { select: { users: true, threats: true } },
      },
    });
    return NextResponse.json({ organization }, { status: 201 });
  } catch (error: any) {
    console.error('Admin create org error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
