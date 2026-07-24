export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

/**
 * Single-organization read/update/delete.
 *
 * A SUPERADMIN may operate on ANY organization by passing its id (`?id=` for
 * GET/DELETE, `id` in the JSON body for PATCH). Every other admin-tier user is
 * pinned to their own organization regardless of the id they send.
 */

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/** Resolve which org the caller is allowed to act on. */
function resolveTargetOrgId(user: any, requestedId?: string | null): string | null {
  const isSuper = user?.role === 'SUPERADMIN';
  if (isSuper && requestedId) return requestedId;
  return user?.organizationId ?? null;
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = session.user as any;
    if (user?.role !== 'ADMIN' && user?.role !== 'SUPERADMIN')
      return NextResponse.json({ error: 'Admin only' }, { status: 403 });

    const requestedId = req.nextUrl.searchParams.get('id');
    const orgId = resolveTargetOrgId(user, requestedId);
    if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 400 });

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      include: { _count: { select: { users: true, threats: true } } },
    });
    if (!org) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ organization: org });
  } catch (error: any) {
    console.error('Admin org error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = session.user as any;
    if (user?.role !== 'ADMIN' && user?.role !== 'SUPERADMIN')
      return NextResponse.json({ error: 'Admin only' }, { status: 403 });

    const body = await req.json();
    const { id, name, slug } = body ?? {};
    const isSuper = user?.role === 'SUPERADMIN';
    const orgId = resolveTargetOrgId(user, id);
    if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 400 });
    if (!name || !String(name).trim())
      return NextResponse.json({ error: 'Name required' }, { status: 400 });

    const data: { name: string; slug?: string } = { name: String(name).trim() };

    // Only SUPERADMIN may change the slug (it is an identity key used across the
    // stack, e.g. by the collector's COLLECTOR_ORG_SLUG).
    if (isSuper && slug != null && String(slug).trim()) {
      const nextSlug = slugify(String(slug));
      if (!nextSlug) return NextResponse.json({ error: 'Invalid slug' }, { status: 400 });
      const clash = await prisma.organization.findFirst({
        where: { slug: nextSlug, NOT: { id: orgId } },
        select: { id: true },
      });
      if (clash) return NextResponse.json({ error: 'Slug already in use' }, { status: 409 });
      data.slug = nextSlug;
    }

    const org = await prisma.organization.update({ where: { id: orgId }, data });
    return NextResponse.json({ organization: org });
  } catch (error: any) {
    console.error('Admin update org error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = session.user as any;
    if (user?.role !== 'SUPERADMIN')
      return NextResponse.json({ error: 'Superadmin only' }, { status: 403 });

    const orgId = req.nextUrl.searchParams.get('id');
    if (!orgId) return NextResponse.json({ error: 'Organization id required' }, { status: 400 });
    if (orgId === user?.organizationId)
      return NextResponse.json({ error: 'You cannot delete your own organization' }, { status: 400 });

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      include: { _count: { select: { users: true, threats: true } } },
    });
    if (!org) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Organization relations are not set to cascade, so refuse to delete an org
    // that still owns users or threats to avoid an opaque FK failure.
    if (org._count.users > 0 || org._count.threats > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete "${org.name}": it still has ${org._count.users} user(s) and ${org._count.threats} threat(s). Move or remove them first.`,
        },
        { status: 409 },
      );
    }

    await prisma.organization.delete({ where: { id: orgId } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Admin delete org error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
