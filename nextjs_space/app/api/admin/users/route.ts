export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';

const VALID_ROLES = ['VIEWER', 'ANALYST', 'DEPARTMENT_ADMIN', 'ADMIN', 'PARENT_ADMIN', 'SUPERADMIN'];

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  createdAt: true,
  organizationId: true,
  organization: { select: { id: true, name: true } },
} as const;

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = session.user as any;
    if (user?.role !== 'ADMIN' && user?.role !== 'SUPERADMIN') return NextResponse.json({ error: 'Admin only' }, { status: 403 });

    const isSuper = user?.role === 'SUPERADMIN';

    // SUPERADMIN sees users across ALL organizations, optionally filtered by ?organizationId=.
    // ADMIN is always scoped to their own organization.
    let where: any;
    if (isSuper) {
      const filterOrg = req.nextUrl.searchParams.get('organizationId');
      where = filterOrg ? { organizationId: filterOrg } : {};
    } else {
      const orgId = user?.organizationId;
      if (!orgId) return NextResponse.json({ users: [] });
      where = { organizationId: orgId };
    }

    const users = await prisma.user.findMany({
      where,
      select: USER_SELECT,
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ users });
  } catch (error: any) {
    console.error('Admin users error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const sUser = session.user as any;
    if (sUser?.role !== 'ADMIN' && sUser?.role !== 'SUPERADMIN') return NextResponse.json({ error: 'Admin only' }, { status: 403 });

    const isSuper = sUser?.role === 'SUPERADMIN';

    const body = await req.json();
    const { userId, role } = body ?? {};
    if (!userId || !role) return NextResponse.json({ error: 'userId and role required' }, { status: 400 });
    if (!VALID_ROLES.includes(role)) return NextResponse.json({ error: 'Invalid role' }, { status: 400 });

    // SUPERADMIN can target a user in any org; ADMIN only within their own org.
    const findWhere: any = isSuper
      ? { id: userId }
      : { id: userId, organizationId: sUser?.organizationId };
    const target = await prisma.user.findFirst({ where: findWhere });
    if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { role },
      select: USER_SELECT,
    });
    return NextResponse.json({ user: updated });
  } catch (error: any) {
    console.error('Admin update user error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const sUser = session.user as any;
    if (sUser?.role !== 'ADMIN' && sUser?.role !== 'SUPERADMIN') return NextResponse.json({ error: 'Admin only' }, { status: 403 });

    const isSuper = sUser?.role === 'SUPERADMIN';

    const body = await req.json();
    const { name, email, password } = body ?? {};
    const role = body?.role || 'ANALYST';

    if (!email || !password) return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    if (!VALID_ROLES.includes(role)) return NextResponse.json({ error: 'Invalid role' }, { status: 400 });

    // Determine target organization.
    // SUPERADMIN may create a user in ANY org via organizationId; falls back to own org.
    // ADMIN always uses their own org, ignoring any supplied organizationId.
    let targetOrgId: string | undefined;
    if (isSuper) {
      targetOrgId = body?.organizationId || sUser?.organizationId;
      if (!targetOrgId) return NextResponse.json({ error: 'organizationId required' }, { status: 400 });
      const org = await prisma.organization.findUnique({ where: { id: targetOrgId } });
      if (!org) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    } else {
      targetOrgId = sUser?.organizationId;
      if (!targetOrgId) return NextResponse.json({ error: 'No organization' }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return NextResponse.json({ error: 'Email already registered' }, { status: 400 });

    const hashedPassword = await bcrypt.hash(password, 12);
    const created = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: name || email.split('@')[0],
        role,
        organizationId: targetOrgId,
      },
      select: USER_SELECT,
    });
    return NextResponse.json({ user: created }, { status: 201 });
  } catch (error: any) {
    console.error('Admin create user error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const sUser = session.user as any;
    if (sUser?.role !== 'ADMIN' && sUser?.role !== 'SUPERADMIN') return NextResponse.json({ error: 'Admin only' }, { status: 403 });

    const isSuper = sUser?.role === 'SUPERADMIN';

    const body = await req.json();
    const { userId } = body ?? {};
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });
    if (userId === sUser?.id) return NextResponse.json({ error: 'You cannot remove your own account' }, { status: 400 });

    // SUPERADMIN can delete a user in any org; ADMIN only within their own org.
    const findWhere: any = isSuper
      ? { id: userId }
      : { id: userId, organizationId: sUser?.organizationId };
    const target = await prisma.user.findFirst({ where: findWhere });
    if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    await prisma.user.delete({ where: { id: userId } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Admin delete user error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
