import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import type { TenantContext } from '@/lib/tenant-context';

export interface WriteAuditEventInput {
  context: TenantContext;
  action: string;
  entityType: string;
  entityId?: string | null;
  departmentId?: string | null;
  metadata?: Prisma.InputJsonValue;
}

export async function writeAuditEvent(input: WriteAuditEventInput): Promise<void> {
  const { context, action, entityType, entityId, departmentId, metadata } = input;

  try {
    await prisma.auditEvent.create({
      data: {
        organizationId: context.organizationId,
        actorUserId: context.userId,
        actorRole: context.role,
        action,
        entityType,
        entityId: entityId ?? null,
        departmentId: departmentId ?? context.departmentId,
        metadata: metadata ?? undefined,
      },
    });
  } catch (error) {
    // Auditing should never expose tenant data or break the primary request.
    console.error('Failed to write audit event:', error);
  }
}
