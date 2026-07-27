import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { hash } from 'bcryptjs';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { canManageRole, hasPermission, isAppRole, normalizeAppRole } from '@/lib/rbac';
import { writeAuditEvent } from '@/lib/audit';

const MANAGEABLE_ROLES = [
  'VIEWER',
  'ANALYST',
  'DEPARTMENT_ADMIN',
  'ADMIN',
  'PARENT_ADMIN',
] as const;

type ManageableRole = (typeof MANAGEABLE_ROLES)[number];

type AdminSessionUser = {
  id: string;
  role: string;
  organizationId: string | null;
  departmentId: string | null;
  parentOrganizationId: string | null;
  accessRevoked?: boolean;
};

async function getAdminUser(): Promise<AdminSessionUser | null> {
  const session = await getServerSession(authOptions);
  const user = session?.user as AdminSessionUser | undefined;
  if (!user || user.accessRevoked || !hasPermission(user.role, 'users.manage')) return null;
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
    parentOrganizationId: admin.parentOrganizationId,
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

function isManageableRole(role: unknown): role is ManageableRole {
  return isAppRole(role) && MANAGEABLE_ROLES.includes(role as ManageableRole);
}

function actorOrganizationScope(admin: AdminSessionUser) {
  const role = normalizeAppRole(admin.role);
  if (role === 'SUPERADMIN') return {};
  if (role === 'PARENT_ADMIN' && admin.parentOrganizationId) {
    return { parentOrganizationId: admin.parentOrganizationId };
  }
  return { id: admin.organizationId ?? '__missing_organization__' };
}

function actorUserScope(admin: AdminSessionUser) {
  const role = normalizeAppRole(admin.role);
  if (role === 'SUPERADMIN') return {};
  if (role === 'PARENT_ADMIN' && admin.parentOrganizationId) {
    return { organization: { parentOrganizationId: admin.parentOrganizationId } };
  }
  if (role === 'DEPARTMENT_ADMIN') {
    return {
      organizationId: admin.organizationId ?? '__missing_organization__',
      departmentId: admin.departmentId ?? '__missing_department__',
    };
  }
  return { organizationId: admin.organizationId ?? '__missing_organization__' };
}

async function validateOrganization(admin: AdminSessionUser, organizationId: string) {
  return prisma.organization.findFirst({
    where: {
      id: organizationId,
      archivedAt: null,
      ...actorOrganizationScope(admin),
    },
    select: { id: true, parentOrganizationId: true },
  });
}

async function validateDepartment(
  admin: AdminSessionUser,
  organizationId: string,
  departmentId?: string | null,
) {
  if (!departmentId) return true;
  if (normalizeAppRole(admin.role) === 'DEPARTMENT_ADMIN' && departmentId !== admin.departmentId) {
    return false;
  }
  return Boolean(await prisma.department.findFirst({
    where: {
      id: departmentId,
      organizationId,
      archivedAt: null,
    },
    select: { id: true },
  }));
}

export async function GET() {
  try {
    const admin = await getAdminUser();
    if (!admin) return unauthorized();

    const users = await prisma.user.findMany({
      where: {
        ...actorUserScope(admin),
        NOT: { id: admin.id },
      },
      select: userSelect,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      users: users.filter((user) => canManageRole(admin.role, user.role)),
    });
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

    const actorRole = normalizeAppRole(admin.role);
    const targetOrganizationId = actorRole === 'SUPERADMIN' || actorRole === 'PARENT_ADMIN'
      ? String(organizationId || admin.organizationId || '')
      : String(admin.organizationId || '');
    if (!targetOrganizationId) {
      return NextResponse.json({ message: 'Organization is required' }, { status: 400 });
    }
    if (!(await validateOrganization(admin, targetOrganizationId))) {
      return NextResponse.json({ message: 'Organization not found, archived, or outside your scope' }, { status: 404 });
    }

    const targetDepartmentId = actorRole === 'DEPARTMENT_ADMIN'
      ? admin.departmentId
      : (departmentId || null);
    if (!(await validateDepartment(admin, targetOrganizationId, targetDepartmentId))) {
      return NextResponse.json({ message: 'Department not found, archived, or outside your scope' }, { status: 400 });
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
        departmentId: targetDepartmentId,
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
    if (userId === admin.id) {
      return NextResponse.json({ message: 'You cannot modify your own authorization assignment' }, { status: 400 });
    }
    if (role && !isManageableRole(role)) {
      return NextResponse.json({ message: 'Invalid role' }, { status: 400 });
    }

    const target = await prisma.user.findFirst({
      where: { id: userId, ...actorUserScope(admin) },
      select: { id: true, email: true, role: true, organizationId: true, departmentId: true },
    });
    if (!target) return NextResponse.json({ message: 'User not found' }, { status: 404 });
    if (!canManageRole(admin.role, target.role)) {
      return NextResponse.json({ message: 'You cannot modify a user with that role' }, { status: 403 });
    }
    if (role && !canManageRole(admin.role, role)) {
      return NextResponse.json({ message: 'You cannot assign that role' }, { status: 403 });
    }

    const actorRole = normalizeAppRole(admin.role);
    if (organizationId !== undefined && !['SUPERADMIN', 'PARENT_ADMIN'].includes(actorRole)) {
      return NextResponse.json({ message: 'You cannot move users between organizations' }, { status: 403 });
    }

    const resultingOrganizationId = organizationId !== undefined
      ? String(organizationId || '')
      : String(target.organizationId || '');
    if (!resultingOrganizationId) {
      return NextResponse.json({ message: 'Organization is required' }, { status: 400 });
    }
    if (!(await validateOrganization(admin, resultingOrganizationId))) {
      return NextResponse.json({ message: 'Organization not found, archived, or outside your scope' }, { status: 404 });
    }

    const resultingDepartmentId = actorRole === 'DEPARTMENT_ADMIN'
      ? admin.departmentId
      : departmentId !== undefined
        ? (departmentId || null)
        : organizationId !== undefined
          ? null
          : target.departmentId;
    if (!(await validateDepartment(admin, resultingOrganizationId, resultingDepartmentId))) {
      return NextResponse.json({ message: 'Department not found, archived, or outside your scope' }, { status: 400 });
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(role ? { role } : {}),
        ...(organizationId !== undefined ? { organizationId: resultingOrganizationId } : {}),
        ...(departmentId !== undefined || organizationId !== undefined
          ? { departmentId: resultingDepartmentId }
          : {}),
      },
      select: userSelect,
    });

    await writeAuditEvent({
      context: auditContext(admin, resultingOrganizationId, user.departmentId),
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
      where: { id: userId, ...actorUserScope(admin) },
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
