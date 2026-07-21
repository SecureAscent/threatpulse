export const ROLES = [
  'VIEWER',
  'ANALYST',
  'DEPARTMENT_ADMIN',
  'ADMIN',
  'PARENT_ADMIN',
  'SUPERADMIN',
] as const;

export type AppRole = (typeof ROLES)[number];

export const PERMISSIONS = [
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
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<AppRole, ReadonlySet<Permission>> = {
  VIEWER: new Set<Permission>([
    'threats.read',
    'assets.read',
  ]),
  ANALYST: new Set<Permission>([
    'threats.read',
    'threats.manage',
    'assets.read',
  ]),
  DEPARTMENT_ADMIN: new Set<Permission>([
    'threats.read',
    'threats.manage',
    'assets.read',
    'assets.manage',
    'users.manage',
    'departments.manage',
    'audit.read',
  ]),
  ADMIN: new Set<Permission>([
    'threats.read',
    'threats.manage',
    'assets.read',
    'assets.manage',
    'integrations.manage',
    'users.manage',
    'organizations.manage',
    'departments.manage',
    'audit.read',
  ]),
  PARENT_ADMIN: new Set<Permission>([
    'threats.read',
    'threats.manage',
    'assets.read',
    'assets.manage',
    'integrations.manage',
    'users.manage',
    'organizations.manage',
    'departments.manage',
    'audit.read',
  ]),
  SUPERADMIN: new Set<Permission>(PERMISSIONS),
};

export function isAppRole(value: unknown): value is AppRole {
  return typeof value === 'string' && ROLES.includes(value.toUpperCase() as AppRole);
}

export function normalizeAppRole(value: unknown): AppRole {
  const normalized = String(value || 'ANALYST').toUpperCase();
  return isAppRole(normalized) ? normalized : 'ANALYST';
}

export function hasPermission(role: unknown, permission: Permission): boolean {
  return ROLE_PERMISSIONS[normalizeAppRole(role)].has(permission);
}

export function hasAnyPermission(role: unknown, permissions: readonly Permission[]): boolean {
  return permissions.some((permission) => hasPermission(role, permission));
}

export function canManageRole(actorRole: unknown, targetRole: unknown): boolean {
  const actor = normalizeAppRole(actorRole);
  const target = normalizeAppRole(targetRole);

  if (actor === 'SUPERADMIN') return target !== 'SUPERADMIN';
  if (actor === 'PARENT_ADMIN') return ['ADMIN', 'DEPARTMENT_ADMIN', 'ANALYST', 'VIEWER'].includes(target);
  if (actor === 'ADMIN') return ['DEPARTMENT_ADMIN', 'ANALYST', 'VIEWER'].includes(target);
  if (actor === 'DEPARTMENT_ADMIN') return ['ANALYST', 'VIEWER'].includes(target);
  return false;
}

export function permissionsForRole(role: AppRole): readonly Permission[] {
  return PERMISSIONS.filter((permission) => ROLE_PERMISSIONS[role].has(permission));
}

export const ROLE_DESCRIPTIONS: Record<AppRole, string> = {
  VIEWER: 'Reads tenant-scoped threats and assets without modification rights.',
  ANALYST: 'Reviews and triages tenant-scoped threats while viewing assigned assets.',
  DEPARTMENT_ADMIN: 'Manages users, threats, assets, departments, and audit data within an assigned department.',
  ADMIN: 'Manages users, departments, integrations, threats, assets, and audit data within one organization.',
  PARENT_ADMIN: 'Manages organizations and their administrative resources within one parent organization.',
  SUPERADMIN: 'Manages the entire platform and may operate across all organizations.',
};
