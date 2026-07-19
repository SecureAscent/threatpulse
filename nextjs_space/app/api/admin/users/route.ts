import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { hash } from 'bcryptjs';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { canManageRole, hasPermission, isAppRole, normalizeAppRole } from '@/lib/rbac';
import { writeAuditEvent } from '@/lib/audit';

const MANAGEABLE_ROLES = ['ADMIN', 'ANALYST'] as const;

type AdminSessionUser = {
  id: string;
  role: string;
  organizationId: string | null;
};

async function getAdminUser(): Promise<AdminSessionUser | null> {
  const session = await getServerSession(authOptions);
  const user = session?.user as AdminSessionUser | undefined;
  if (!user || !hasPermission(user.role, 'users.manage')) return null;
  return user;
}

function unauthorized() {
  return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
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

const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  organizationId: true,
  departmentId: true,
  organization: { select: { id: true, name: true, slug: true } },
  department: { select: { id: true, name: true, slug: true } },
  createdAt: true,
} as const;

async function validateDepartment(organizationId: string, departmentId?: string | null) {
  if (!departmentId) return true;
  return Boolean(await prisma.department.findFirst({
    where: { id: departmentId, organizationId },
    select: { id: true },
  }));
}

function isManageableRole(role: unknown): role is (typeof MANAGEABLE_ROLES)[number] {
  return isAppRole(role) && MANAGEABLE_ROLES.includes(role as (typeof MANAGEABLE_ROLES)[number]);
}

export async function GET() {
  try {
    const admin = await getAdminUser();
    if (!admin) return unauthorized();
    if (admin.role !== 'SUPERADMIN' && !admin.organizationId) return NextResponse.json({ users: [] });

    const users = await prisma.user.findMany({
      where: admin.role === 'SUPERADMIN'
        ? undefined
        : { organizationId: admin.organizationId, role: 'ANALYST' },
      select: userSelect,
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ users });
  } catch (error) {
    console.error('[USERS_GET_ERROR]', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const admin = await getAdminUser();
    if (!admin) return unauthorized();

    const body = await req.json();
    const { name, email, password, role = 'ANALYST', organizationId, departmentId } = body ?? {};
    if (!name?.trim() || !email?.trim() || !password) {
      return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
    }
    if (!isManageableRole(role)) {
      return NextResponse.json({ message: 'Invalid role' }, { status: 400 });
    }
    if (!canManageRole(admin.role, role)) {
      return NextResponse.json({ message: 'You cannot create a user with that role' }, { status: 403 });
    }

    const targetOrganizationId = admin.role === 'SUPERADMIN' ? organizationId : admin.organizationId;
    if (!targetOrganizationId) return NextResponse.json({ message: 'Organization is required' }, { status: 400 });

    const organization = await prisma.organization.findUnique({ where: { id: targetOrganizationId }, select: { id: true } });
    if (!organization) return NextResponse.json({ message: 'Organization not found' }, { status: 404 });
    if (!(await validateDepartment(targetOrganizationId, departmentId))) {
      return NextResponse.json({ message: 'Department does not belong to the selected organization' }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (await prisma.user.findUnique({ where: { email: normalizedEmail }, select: { id: true } })) {
      return NextResponse.json({ message: 'User with this email already exists' }, { status: 409 });
    }

    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        password: await hash(password, 12),
        role,
        organizationId: targetOrganizationId,
        departmentId: departmentId || null,
      },
      select: userSelect,
    });

    await writeAuditEvent({
      context: auditContext(admin, targetOrganizationId, user.departmentId),
      action: 'user.create',
      entityType: 'User',
      entityId: user.id,
      departmentId: user.departmentId,
      metadata: { email: user.email, role: user.role },
    });

    return NextResponse.json({ message: 'User created successfully', user }, { status: 201 });
  } catch (error) {
    console.error('[USERS_POST_ERROR]', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const admin = await getAdminUser();
    if (!admin) return unauthorized();

    const body = await req.json();
    const { userId, role, organizationId, departmentId } = body ?? {};
    if (!userId || (!role && organizationId === undefined && departmentId === undefined)) {
      return NextResponse.json({ message: 'No changes supplied' }, { status: 400 });
    }
    if (role && !isManageableRole(role)) {
      return NextResponse.json({ message: 'Invalid role' }, { status: 400 });
    }

    const target = await prisma.user.findFirst({
      where: admin.role === 'SUPERADMIN' ? { id: userId } : { id: userId, organizationId: admin.organizationId },
      select: { id: true, email: true, role: true, organizationId: true, departmentId: true },
    });
    if (!target) return NextResponse.json({ message: 'User not found' }, { status: 404 });
    if (!canManageRole(admin.role, target.role)) {
      return NextResponse.json({ message: 'You cannot modify a user with that role' }, { status: 403 });
    }
    if (role && !canManageRole(admin.role, role)) {
      return NextResponse.json({ message: 'You cannot assign that role' }, { status: 403 });
    }
    if (organizationId !== undefined && admin.role !== 'SUPERADMIN') {
      return NextResponse.json({ message: 'Only super administrators can move users between organizations' }, { status: 403 });
    }

    const resultingOrganizationId = organizationId !== undefined
      ? (organizationId || null)
      : target.organizationId;
    if (resultingOrganizationId && !(await validateDepartment(resultingOrganizationId, departmentId))) {
      return NextResponse.json({ message: 'Department does not belong to the selected organization' }, { status: 400 });
    }
    if (!resultingOrganizationId && departmentId) {
      return NextResponse.json({ message: 'An organization is required when assigning a department' }, { status: 400 });
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(role ? { role } : {}),
        ...(organizationId !== undefined ? { organizationId: organizationId || null } : {}),
        ...(departmentId !== undefined ? { departmentId: departmentId || null } : {}),
        ...(organizationId !== undefined && !departmentId ? { departmentId: null } : {}),
      },
      select: userSelect,
    });

    if (user.organizationId) {
      await writeAuditEvent({
        context: auditContext(admin, user.organizationId, user.departmentId),
        action: 'user.update',
        entityType: 'User',
        entityId: user.id,
        departmentId: user.departmentId,
        metadata: {
          email: user.email,
          before: { role: target.role, organizationId: target.organizationId, departmentId: target.departmentId },
          after: { role: user.role, organizationId: user.organizationId, departmentId: user.departmentId },
        },
      });
    }

    return NextResponse.json({ message: 'User updated successfully', user });
  } catch (error) {
    console.error('[USERS_PATCH_ERROR]', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const admin = await getAdminUser();
    if (!admin) return unauthorized();
    const userId = new URL(req.url).searchParams.get('userId');
    if (!userId) return NextResponse.json({ message: 'Missing userId parameter' }, { status: 400 });
    if (admin.id === userId) return NextResponse.json({ message: 'You cannot delete your own account' }, { status: 400 });

    const target = await prisma.user.findFirst({
      where: admin.role === 'SUPERADMIN' ? { id: userId } : { id: userId, organizationId: admin.organizationId },
      select: { id: true, email: true, role: true, organizationId: true, departmentId: true },
    });
    if (!target) return NextResponse.json({ message: 'User not found' }, { status: 404 });
    if (!canManageRole(admin.role, target.role)) {
      return NextResponse.json({ message: 'You cannot delete a user with that role' }, { status: 403 });
    }

    await prisma.user.delete({ where: { id: userId } });

    if (target.organizationId) {
      await writeAuditEvent({
        context: auditContext(admin, target.organizationId, target.departmentId),
        action: 'user.delete',
        entityType: 'User',
        entityId: target.id,
        departmentId: target.departmentId,
        metadata: { email: target.email, role: target.role },
      });
    }

    return NextResponse.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('[USERS_DELETE_ERROR]', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}
