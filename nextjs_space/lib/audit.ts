import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import type { TenantContext } from '@/lib/tenant-context';

export interface WriteAuditEventInput {
  context?: TenantContext;
  ctx?: TenantContext;
  action: string;
  entityType?: string;
  entityId?: string | null;
  targetType?: string;
  targetId?: string | null;
  departmentId?: string | null;
  metadata?: Prisma.InputJsonValue;
  userId?: string | null;
  organizationId?: string | null;
  actorEmail?: string | null;
  ipAddress?: string | null;
}

export async function writeAuditEvent(input: WriteAuditEventInput): Promise<void> {
  try {
    if (input.context) {
      const { context, action, entityType, entityId, departmentId, metadata } = input;
      await prisma.auditEvent.create({
        data: {
          organizationId: context.organizationId,
          actorUserId: context.userId,
          actorRole: context.role,
          action,
          entityType: entityType ?? input.targetType ?? 'Unknown',
          entityId: entityId ?? input.targetId ?? null,
          departmentId: departmentId ?? context.departmentId,
          metadata: metadata ?? undefined,
        },
      });
      return;
    }

    const context = input.ctx;
    await prisma.auditLog.create({
      data: {
        organizationId: context?.organizationId ?? input.organizationId ?? null,
        userId: context?.userId ?? input.userId ?? null,
        actorEmail: context?.email || input.actorEmail || null,
        action: input.action,
        targetType: input.targetType ?? input.entityType ?? null,
        targetId: input.targetId ?? input.entityId ?? null,
        metadata:
          input.metadata === undefined ? null : JSON.stringify(input.metadata),
        ipAddress: input.ipAddress ?? null,
      },
    });
  } catch (error) {
    // Auditing should never expose tenant data or break the primary request.
    console.error('Failed to write audit event:', error);
  }
}
