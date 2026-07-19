import type { Prisma } from '@prisma/client';
import type { TenantContext } from '@/lib/tenant-context';
import { organizationScope } from '@/lib/organization-admin';

export function normalizeDepartmentSlug(value: unknown): string {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63);
}

export function validateDepartmentInput(body: Record<string, unknown>) {
  const name = String(body.name || '').trim();
  const slug = normalizeDepartmentSlug(body.slug || name);

  if (name.length < 2 || name.length > 120) {
    throw new Error('Department name must be between 2 and 120 characters.');
  }
  if (!slug || slug.length > 63) {
    throw new Error('Department slug must contain letters or numbers and be no longer than 63 characters.');
  }

  return { name, slug };
}

export function managedDepartmentScope(context: TenantContext): Prisma.DepartmentWhereInput {
  return {
    organization: organizationScope(context),
    ...(context.role === 'DEPARTMENT_ADMIN' && context.departmentId
      ? { id: context.departmentId }
      : {}),
  };
}
