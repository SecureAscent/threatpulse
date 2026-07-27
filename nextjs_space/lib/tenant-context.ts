import type { Prisma } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import {
  hasPermission as roleHasPermission,
  normalizeAppRole,
  type AppRole,
} from '@/lib/rbac';

export type TenantRole = AppRole;

export type TenantPermission =
  | 'threats.read'
  | 'threats.manage'
  | 'threats.create'
  | 'threats.update'
  | 'threats.delete'
  | 'organizations.manage'
  | 'users.manage'
  | 'integrations.manage';

export interface TenantContext {
  userId: string;
  email?: string;
  role: TenantRole;
  organizationId: string;
  departmentId: string | null;
  parentOrganizationId: string | null;
}

const TENANT_PERMISSION_MAP = {
  'threats.read': 'threats.read',
  'threats.manage': 'threats.manage',
  'threats.create': 'threats.manage',
  'threats.update': 'threats.manage',
  'threats.delete': 'threats.manage',
  'organizations.manage': 'organizations.manage',
  'users.manage': 'users.manage',
  'integrations.manage': 'integrations.manage',
} as const;

export async function getTenantContext(_request?: unknown): Promise<TenantContext | null> {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;

  if (!user?.id || !user?.organizationId || user?.accessRevoked) return null;

  return {
    userId: String(user.id),
    email: String(user.email ?? ''),
    role: normalizeAppRole(user.role),
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
  if (permission === 'threats.delete') {
    return ['ADMIN', 'PARENT_ADMIN', 'SUPERADMIN'].includes(context.role);
  }

  return roleHasPermission(context.role, TENANT_PERMISSION_MAP[permission]);
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
  return ['ADMIN', 'PARENT_ADMIN', 'SUPERADMIN'].includes(context.role);
}

export function isAdmin(context: TenantContext): boolean {
  return ['DEPARTMENT_ADMIN', 'ADMIN', 'PARENT_ADMIN', 'SUPERADMIN'].includes(
    context.role,
  );
}

export function hasRole(
  context: TenantContext,
  ...roles: TenantRole[]
): boolean {
  return roles.includes(context.role);
}

export function normalizeRole(role: unknown): TenantRole {
  return normalizeAppRole(role);
}
