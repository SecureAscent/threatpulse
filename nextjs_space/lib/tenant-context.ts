import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { sha256 } from '@/lib/crypto';

/**
 * Unified tenant/auth context resolution for API routes.
 *
 * A request may be authenticated either by an interactive NextAuth session
 * (a signed-in user) or by an API key presented as `Authorization: Bearer tp_...`.
 * `getTenantContext()` normalises both into a single shape so route handlers
 * can enforce permissions consistently.
 */

export type Role =
  | 'VIEWER'
  | 'ANALYST'
  | 'DEPARTMENT_ADMIN'
  | 'ADMIN'
  | 'PARENT_ADMIN'
  | 'SUPERADMIN';

export type Permission =
  | 'threats.read'
  | 'threats.manage'
  | 'assets.read'
  | 'assets.manage'
  | 'integrations.manage'
  | 'users.manage'
  | 'organizations.manage'
  | 'departments.manage'
  | 'audit.read'
  | 'platform.manage';

const ALL_PERMISSIONS: Permission[] = [
  'threats.read',
  'threats.manage',
  'assets.read',
  'assets.manage',
  'integrations.manage',
  'users.manage',
  'organizations.manage',
  'departments.manage',
  'audit.read',
  'platform.manage',
];

/** Role → granted permissions. Higher roles are supersets of lower ones. */
const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  VIEWER: ['threats.read', 'assets.read'],
  ANALYST: ['threats.read', 'threats.manage', 'assets.read', 'assets.manage'],
  DEPARTMENT_ADMIN: [
    'threats.read',
    'threats.manage',
    'assets.read',
    'assets.manage',
    'users.manage',
    'audit.read',
  ],
  ADMIN: [
    'threats.read',
    'threats.manage',
    'assets.read',
    'assets.manage',
    'integrations.manage',
    'users.manage',
    'organizations.manage',
    'departments.manage',
    'audit.read',
  ],
  PARENT_ADMIN: [
    'threats.read',
    'threats.manage',
    'assets.read',
    'assets.manage',
    'integrations.manage',
    'users.manage',
    'organizations.manage',
    'departments.manage',
    'audit.read',
  ],
  SUPERADMIN: ALL_PERMISSIONS,
};

export interface TenantContext {
  source: 'session' | 'apikey';
  userId: string | null;
  email: string | null;
  organizationId: string | null;
  role: Role;
  /** Explicit permission set (derived from role, or from API key scopes). */
  permissions: Permission[];
  /** For API-key requests only: the key id, for audit trails. */
  apiKeyId?: string;
}

function normaliseRole(role: string | null | undefined): Role {
  const r = (role || 'ANALYST').toUpperCase();
  if (
    r === 'VIEWER' ||
    r === 'ANALYST' ||
    r === 'DEPARTMENT_ADMIN' ||
    r === 'ADMIN' ||
    r === 'PARENT_ADMIN' ||
    r === 'SUPERADMIN'
  ) {
    return r;
  }
  return 'ANALYST';
}

export function permissionsForRole(role: Role): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
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
    if (
      !key ||
      key.revokedAt ||
      (key.expiresAt && key.expiresAt.getTime() < Date.now())
    ) {
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
      permissions: scopes,
      apiKeyId: key.id,
    };
  }

  // 2) Interactive session auth
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  const u = session.user as any;
  const role = normaliseRole(u.role);
  return {
    source: 'session',
    userId: u.id ?? null,
    email: u.email ?? null,
    organizationId: u.organizationId ?? null,
    role,
    permissions: permissionsForRole(role),
  };
}

/** Does this context hold the given permission? */
export function hasPermission(ctx: TenantContext | null, permission: Permission): boolean {
  if (!ctx) return false;
  return ctx.permissions.includes(permission);
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

/**
 * Build a Prisma `where` fragment scoping a query to the caller's tenant.
 * SUPERADMIN sees all organizations; everyone else is pinned to their org.
 */
export function buildOrgScope(ctx: TenantContext | null): { organizationId?: string } {
  if (!ctx) return { organizationId: '__none__' };
  if (ctx.role === 'SUPERADMIN' && ctx.source === 'session') return {};
  return { organizationId: ctx.organizationId ?? '__none__' };
}
