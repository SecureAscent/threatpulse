import type { Prisma } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { sha256 } from '@/lib/crypto';
import {
  hasPermission as roleHasPermission,
  normalizeAppRole,
  type AppRole,
  type Permission as RbacPermission,
  permissionsForRole as rbacPermissionsForRole,
} from '@/lib/rbac';

/**
 * Unified tenant/auth context resolution for API routes.
 *
 * A request may be authenticated either by an interactive NextAuth session
 * (a signed-in user) or by an API key presented as `Authorization: Bearer tp_...`.
 * `getTenantContext()` normalises both into a single shape so route handlers
 * can enforce permissions consistently.
 */

export type Role = AppRole;

export type Permission =
  | 'threats.read'
  | 'threats.manage'
  | 'threats.create'
  | 'threats.update'
  | 'threats.delete'
  | 'assets.read'
  | 'assets.manage'
  | 'integrations.manage'
  | 'users.manage'
  | 'organizations.manage'
  | 'departments.manage'
  | 'audit.read'
  | 'platform.manage';

const ALL_PERMISSIONS: Permission[] = [
  'threats.read', 'threats.manage', 'threats.create', 'threats.update', 'threats.delete',
  'assets.read', 'assets.manage', 'integrations.manage', 'users.manage',
  'organizations.manage', 'departments.manage', 'audit.read', 'platform.manage',
];

/**
 * Map the public Permission enum onto the rbac permission set.
 * rbac folds create/update/delete into the single 'threats.manage' permission;
 * threats.delete is additionally gated by role in `hasPermission`.
 */
const PERM_TO_RBAC: Record<Permission, RbacPermission> = {
  'threats.read': 'threats.read',
  'threats.manage': 'threats.manage',
  'threats.create': 'threats.manage',
  'threats.update': 'threats.manage',
  'threats.delete': 'threats.manage',
  'assets.read': 'assets.read',
  'assets.manage': 'assets.manage',
  'integrations.manage': 'integrations.manage',
  'users.manage': 'users.manage',
  'organizations.manage': 'organizations.manage',
  'departments.manage': 'departments.manage',
  'audit.read': 'audit.read',
  'platform.manage': 'platform.manage',
};

const ADMIN_ROLES: Role[] = ['ADMIN', 'PARENT_ADMIN', 'SUPERADMIN'];

export interface TenantContext {
  /** 'session' for interactive users, 'apikey' for machine-to-machine callers. */
  source: 'session' | 'apikey';
  userId: string | null;
  email: string | null;
  organizationId: string | null;
  role: Role;
  /** Department within the org (session users only); null for org-wide scope. */
  departmentId: string | null;
  /** Parent org id when this org is a sub-organization; null otherwise. */
  parentOrganizationId: string | null;
  /** Effective permission set — derived from role (session) or key scopes (apikey). */
  permissions: Permission[];
  /** API-key id, for audit trails (apikey only). */
  apiKeyId?: string;
}

export function permissionsForRole(role: Role): Permission[] {
  return rbacPermissionsForRole(role) as unknown as Permission[];
}

/**
 * Resolve the tenant context for an incoming request.
 *
 * @param req Optional Request/NextRequest. Required to support API-key auth
 *            (the Authorization header is read from it). When omitted, only
 *            interactive session auth is attempted.
 */
export async function getTenantContext(req?: Request): Promise<TenantContext | null> {
  // 1) API key auth (machine-to-machine)
  const authHeader = req?.headers?.get('authorization') || '';
  if (authHeader.toLowerCase().startsWith('bearer tp_')) {
    const rawKey = authHeader.slice(7).trim(); // strip "Bearer "
    const keyHash = sha256(rawKey);
    const key = await prisma.apiKey.findUnique({ where: { keyHash } });
    if (!key || key.revokedAt || (key.expiresAt && key.expiresAt.getTime() < Date.now())) {
      return null;
    }
    // Best-effort last-used tracking (do not block the request on failure).
    prisma.apiKey
      .update({ where: { id: key.id }, data: { lastUsedAt: new Date() } })
      .catch(() => undefined);

    const scopes = (key.scopes as string[]).filter((s): s is Permission =>
      (ALL_PERMISSIONS as string[]).includes(s),
    );
    return {
      source: 'apikey',
      userId: key.createdById,
      email: null,
      organizationId: key.organizationId,
      role: 'ANALYST', // baseline; effective access is governed by scopes
      departmentId: null,
      parentOrganizationId: null,
      permissions: scopes,
      apiKeyId: key.id,
    };
  }

  // 2) Interactive session auth
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  const u = session.user as any;
  const role = normalizeAppRole(u.role) as Role;
  return {
    source: 'session',
    userId: u.id ?? null,
    email: u.email ?? null,
    organizationId: u.organizationId ?? null,
    role,
    departmentId: u.departmentId ? String(u.departmentId) : null,
    parentOrganizationId: u.parentOrganizationId ? String(u.parentOrganizationId) : null,
    permissions: permissionsForRole(role),
  };
}

/** Does this context hold the given permission? */
export function hasPermission(ctx: TenantContext | null, permission: Permission): boolean {
  if (!ctx) return false;
  // API-key contexts are governed by their explicit scopes.
  if (ctx.source === 'apikey') {
    return (ctx.permissions || []).includes(permission);
  }
  // Session contexts derive access from the role via rbac.
  if (permission === 'threats.delete') {
    return ADMIN_ROLES.includes(ctx.role);
  }
  return roleHasPermission(ctx.role, PERM_TO_RBAC[permission]);
}

/** True when the context's role is one of the accepted roles (session only). */
export function hasRole(ctx: TenantContext | null, ...roles: Role[]): boolean {
  if (!ctx) return false;
  return roles.includes(ctx.role);
}

/** Convenience: admin-tier roles. */
export function isAdmin(ctx: TenantContext | null): boolean {
  return hasRole(ctx, 'ADMIN', 'PARENT_ADMIN', 'SUPERADMIN');
}

/** True when the context may reassign department membership (org admins only). */
export function canAssignDepartment(ctx: TenantContext): boolean {
  return ADMIN_ROLES.includes(ctx.role);
}

/** Normalise an arbitrary role value into a known Role. */
export function normalizeRole(role: unknown): Role {
  return normalizeAppRole(role);
}

/**
 * Build a Prisma `where` fragment scoping a Threat query to the caller's
 * department and organisation. Department users see their own department
 * plus org-wide (unassigned) threats; everyone else sees the whole org.
 */
export function buildThreatScope(ctx: TenantContext): Prisma.ThreatWhereInput {
  return {
    organizationId: ctx.organizationId ?? undefined,
    ...(ctx.departmentId
      ? { OR: [{ departmentId: ctx.departmentId }, { departmentId: null }] }
      : {}),
  };
}

/**
 * Build a Prisma `where` fragment scoping a query to the caller's tenant.
 * SUPERADMIN sees all organizations; everyone else is pinned to their org.
 */
export function buildOrgScope(ctx: TenantContext | null): { organizationId?: string } {
  if (!ctx) return { organizationId: '__none__' };
  if (ctx.role === 'SUPERADMIN' && ctx.source === 'session') return {};
  return { organizationId: ctx.organizationId ?? '__none__' };
}
