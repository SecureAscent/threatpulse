import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { hash } from 'bcryptjs';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';

const MANAGEABLE_ROLES = ['ADMIN', 'ANALYST'] as const;

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

function unauthorized() {
  return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
}

export async function GET() {
  try {
    const admin = await getAdminUser();
    if (!admin) return unauthorized();

    if (admin.role !== 'SUPERADMIN' && !admin.organizationId) {
      return NextResponse.json({ users: [] });
    }

    const users = await prisma.user.findMany({
      where: admin.role === 'SUPERADMIN'
        ? undefined
        : { organizationId: admin.organizationId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        organizationId: true,
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({ users });
  } catch (error: unknown) {
    console.error('[USERS_GET_ERROR]', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const admin = await getAdminUser();
    if (!admin) return unauthorized();

    const body = await req.json();
    const { name, email, password, role = 'ANALYST', organizationId } = body ?? {};

    if (!name?.trim() || !email?.trim() || !password) {
      return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
    }

    if (!MANAGEABLE_ROLES.includes(role)) {
      return NextResponse.json({ message: 'Invalid role' }, { status: 400 });
    }

    const targetOrganizationId = admin.role === 'SUPERADMIN'
      ? organizationId
      : admin.organizationId;

    if (!targetOrganizationId) {
      return NextResponse.json({ message: 'Organization is required' }, { status: 400 });
    }

    const organization = await prisma.organization.findUnique({
      where: { id: targetOrganizationId },
      select: { id: true },
    });

    if (!organization) {
      return NextResponse.json({ message: 'Organization not found' }, { status: 404 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });

    if (existingUser) {
      return NextResponse.json({ message: 'User with this email already exists' }, { status: 409 });
    }

    const newUser = await prisma.user.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        password: await hash(password, 12),
        role,
        organizationId: targetOrganizationId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        organizationId: true,
        organization: {
          select: { id: true, name: true, slug: true },
        },
        createdAt: true,
      },
    });

    return NextResponse.json({
      message: 'User created successfully',
      user: newUser,
    }, { status: 201 });
  } catch (error: unknown) {
    console.error('[USERS_POST_ERROR]', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const admin = await getAdminUser();
    if (!admin) return unauthorized();

    const body = await req.json();
    const { userId, role, organizationId } = body ?? {};

    if (!userId || (!role && organizationId === undefined)) {
      return NextResponse.json({ message: 'No changes supplied' }, { status: 400 });
    }

    if (role && !MANAGEABLE_ROLES.includes(role)) {
      return NextResponse.json({ message: 'Invalid role' }, { status: 400 });
    }

    const target = await prisma.user.findFirst({
      where: admin.role === 'SUPERADMIN'
        ? { id: userId }
        : { id: userId, organizationId: admin.organizationId },
      select: { id: true, role: true, organizationId: true },
    });

    if (!target) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    if (target.role === 'SUPERADMIN' && admin.role !== 'SUPERADMIN') {
      return NextResponse.json({ message: 'Cannot modify a super administrator' }, { status: 403 });
    }

    if (organizationId !== undefined && admin.role !== 'SUPERADMIN') {
      return NextResponse.json({ message: 'Only super administrators can move users between organizations' }, { status: 403 });
    }

    if (organizationId) {
      const organization = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { id: true },
      });
      if (!organization) {
        return NextResponse.json({ message: 'Organization not found' }, { status: 404 });
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(role ? { role } : {}),
        ...(organizationId !== undefined ? { organizationId: organizationId || null } : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        organizationId: true,
        organization: {
          select: { id: true, name: true, slug: true },
        },
        createdAt: true,
      },
    });

    return NextResponse.json({
      message: 'User updated successfully',
      user: updatedUser,
    });
  } catch (error: unknown) {
    console.error('[USERS_PATCH_ERROR]', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const admin = await getAdminUser();
    if (!admin) return unauthorized();

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ message: 'Missing userId parameter' }, { status: 400 });
    }

    if (admin.id === userId) {
      return NextResponse.json({ message: 'You cannot delete your own account' }, { status: 400 });
    }

    const target = await prisma.user.findFirst({
      where: admin.role === 'SUPERADMIN'
        ? { id: userId }
        : { id: userId, organizationId: admin.organizationId },
      select: { id: true, role: true },
    });

    if (!target) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    if (target.role === 'SUPERADMIN' && admin.role !== 'SUPERADMIN') {
      return NextResponse.json({ message: 'Cannot delete a super administrator' }, { status: 403 });
    }

    await prisma.user.delete({ where: { id: userId } });

    return NextResponse.json({ message: 'User deleted successfully' });
  } catch (error: unknown) {
    console.error('[USERS_DELETE_ERROR]', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}
