import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

/**
 * Returns the currently authenticated user or throws when unauthenticated.
 */
export async function requireUser() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    throw new Error('Unauthorized');
  }

  return session.user as any;
}

/**
 * Returns the authenticated user's organization.
 * All tenant-scoped operations should use this helper before querying data.
 */
export async function requireOrganization() {
  const user = await requireUser();

  if (!user.organizationId) {
    throw new Error('User is not assigned to an organization');
  }

  const organization = await prisma.organization.findUnique({
    where: { id: user.organizationId },
  });

  if (!organization) {
    throw new Error('Organization not found');
  }

  return organization;
}

/**
 * Ensures a user has one of the required application roles.
 */
export async function requireRole(...roles: string[]) {
  const user = await requireUser();

  if (!roles.includes(user.role)) {
    throw new Error('Forbidden');
  }

  return user;
}

/**
 * Standard Prisma filter for tenant-scoped resources.
 */
export async function organizationFilter() {
  const organization = await requireOrganization();

  return {
    organizationId: organization.id,
  };
}
