import type { Prisma } from '@prisma/client';
import type { TenantContext } from '@/lib/tenant-context';

export function normalizeOrganizationSlug(value: unknown): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function organizationScope(
  context: TenantContext,
): Prisma.OrganizationWhereInput {
  if (context.role === 'SUPERADMIN') return {};

  if (context.role === 'PARENT_ADMIN' && context.parentOrganizationId) {
    return { parentOrganizationId: context.parentOrganizationId };
  }

  return { id: context.organizationId };
}

export function canCreateOrganization(context: TenantContext): boolean {
  return context.role === 'SUPERADMIN' || (
    context.role === 'PARENT_ADMIN' && Boolean(context.parentOrganizationId)
  );
}

export function parentOrganizationForCreate(
  context: TenantContext,
  requestedParentOrganizationId: unknown,
): string | null {
  if (context.role === 'PARENT_ADMIN') {
    return context.parentOrganizationId;
  }

  const value = String(requestedParentOrganizationId || '').trim();
  return value || null;
}

export function validateOrganizationInput(input: {
  name?: unknown;
  slug?: unknown;
  timezone?: unknown;
}) {
  const name = String(input.name || '').trim();
  const slug = normalizeOrganizationSlug(input.slug || name);
  const timezone = String(input.timezone || 'UTC').trim();

  if (name.length < 2 || name.length > 120) {
    throw new Error('Organization name must be between 2 and 120 characters.');
  }
  if (slug.length < 2) {
    throw new Error('Organization slug must contain at least 2 letters or numbers.');
  }
  if (timezone.length < 1 || timezone.length > 80) {
    throw new Error('Timezone must be between 1 and 80 characters.');
  }

  return { name, slug, timezone };
}
