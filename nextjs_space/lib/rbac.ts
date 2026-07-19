export const ROLES = ['ANALYST', 'ADMIN', 'SUPERADMIN'] as const;

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
  ANALYST: new Set<Permission>([
    'threats.read',
    'assets.read',
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
  SUPERADMIN: new Set<Permission>(PERMISSIONS),
};

export function isAppRole(value: unknown): value is AppRole {
  return typeof value === 'string' && ROLES.includes(value as AppRole);
}

export function hasPermission(role: unknown, permission: Permission): boolean {
  return isAppRole(role) && ROLE_PERMISSIONS[role].has(permission);
}

export function hasAnyPermission(role: unknown, permissions: readonly Permission[]): boolean {
  return permissions.some((permission) => hasPermission(role, permission));
}

export function canManageRole(actorRole: unknown, targetRole: unknown): boolean {
  if (!isAppRole(actorRole) || !isAppRole(targetRole)) return false;
  if (actorRole === 'SUPERADMIN') return true;
  return actorRole === 'ADMIN' && targetRole === 'ANALYST';
}

export function permissionsForRole(role: AppRole): readonly Permission[] {
  return PERMISSIONS.filter((permission) => ROLE_PERMISSIONS[role].has(permission));
}

export const ROLE_DESCRIPTIONS: Record<AppRole, string> = {
  ANALYST: 'Reviews tenant-scoped threats and assets without administrative access.',
  ADMIN: 'Manages users, departments, integrations, threats, assets, and audit data within one organization.',
  SUPERADMIN: 'Manages the entire platform and may operate across all organizations.',
};
