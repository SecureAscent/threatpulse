import type { Prisma } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';

export type TenantRole =
  | 'SUPERADMIN'
  | 'ADMIN'
  | 'PARENT_ADMIN'
  | 'DEPARTMENT_ADMIN'
  | 'ANALYST'
  | 'VIEWER';

export type TenantPermission =
  | 'threats.read'
  | 'threats.create'
  | 'threats.update'
  | 'threats.delete'
  | 'organizations.manage'
  | 'users.manage'
  | 'integrations.manage';

export interface TenantContext {
  userId: string;
  role: TenantRole;
  organizationId: string;
  departmentId: string | null;
  parentOrganizationId: string | null;
}

const ROLE_PERMISSIONS: Record<TenantRole, ReadonlySet<TenantPermission>> = {
  SUPERADMIN: new Set([
    'threats.read',
    'threats.create',
    'threats.update',
    'threats.delete',
    'organizations.manage',
    'users.manage',
    'integrations.manage',
  ]),
  ADMIN: new Set([
    'threats.read',
    'threats.create',
    'threats.update',
    'threats.delete',
    'organizations.manage',
    'users.manage',
    'integrations.manage',
  ]),
  PARENT_ADMIN: new Set([
    'threats.read',
    'threats.create',
    'threats.update',
    'organizations.manage',
    'users.manage',
    'integrations.manage',
  ]),
  DEPARTMENT_ADMIN: new Set([
    'threats.read',
    'threats.create',
    'threats.update',
    'users.manage',
  ]),
  ANALYST: new Set(['threats.read', 'threats.create', 'threats.update']),
  VIEWER: new Set(['threats.read']),
};

export async function getTenantContext(): Promise<TenantContext | null> {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;

  if (!user?.id || !user?.organizationId) return null;

  return {
    userId: String(user.id),
    role: normalizeRole(user.role),
    organizationId: String(user.organizationId),
    departmentId: user.departmentId ? String(user.departmentId) : null,
    parentOrganizationId: user.parentOrganizationId
      ? String(user.parentOrganizationId)
      : null,
  };
}

export function hasPermission(
  context: TenantContext,
  permission: TenantPermission,
): boolean {
  return ROLE_PERMISSIONS[context.role].has(permission);
}

export function buildThreatScope(
  context: TenantContext,
): Prisma.ThreatWhereInput {
  return {
    organizationId: context.organizationId,
    ...(context.departmentId
      ? { OR: [{ departmentId: context.departmentId }, { departmentId: null }] }
      : {}),
  };
}

export function canAssignDepartment(context: TenantContext): boolean {
  return ['SUPERADMIN', 'ADMIN', 'PARENT_ADMIN'].includes(context.role);
}

export function normalizeRole(role: unknown): TenantRole {
  const normalized = String(role || 'ANALYST').toUpperCase();
  if (normalized in ROLE_PERMISSIONS) return normalized as TenantRole;
  return 'ANALYST';
}
