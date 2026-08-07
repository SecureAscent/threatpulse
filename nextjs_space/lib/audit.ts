import { prisma } from '@/lib/db';
import type { TenantContext } from '@/lib/tenant-context';

/**
 * Append an entry to the audit trail. Never throws — auditing must not break
 * the operation it is recording. Failures are logged to the console instead.
 *
 * Accepts both the canonical shape (ctx/targetType/targetId) and the legacy
 * alias shape (context/entityType/entityId/departmentId) used by some route
 * handlers; aliases are resolved onto the canonical fields below.
 */
export interface AuditEventInput {
  action: string;
  /** Canonical tenant context. */
  ctx?: TenantContext | null;
  /** Alias for ctx (accepted for backwards compatibility). */
  context?: TenantContext | null;
  organizationId?: string | null;
  userId?: string | null;
  actorEmail?: string | null;
  /** Canonical audited-entity type. */
  targetType?: string | null;
  /** Alias for targetType. */
  entityType?: string | null;
  /** Canonical audited-entity id. */
  targetId?: string | null;
  /** Alias for targetId. */
  entityId?: string | null;
  /** Optional department id; folded into metadata when present. */
  departmentId?: string | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
}

export async function writeAuditEvent(input: AuditEventInput): Promise<void> {
  try {
    const ctx = input.ctx ?? input.context ?? null;
    const targetType = input.targetType ?? input.entityType ?? null;
    const targetId = input.targetId ?? input.entityId ?? null;
    const metadata: Record<string, unknown> | null = input.metadata
      ? input.departmentId
        ? { ...input.metadata, departmentId: input.departmentId }
        : input.metadata
      : input.departmentId
        ? { departmentId: input.departmentId }
        : null;
    await prisma.auditLog.create({
      data: {
        action: input.action,
        organizationId: input.organizationId ?? ctx?.organizationId ?? null,
        userId: input.userId ?? ctx?.userId ?? null,
        actorEmail: input.actorEmail ?? ctx?.email ?? null,
        targetType,
        targetId,
        metadata: metadata ? JSON.stringify(metadata) : null,
        ipAddress: input.ipAddress ?? null,
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[audit] failed to write event', input.action, err);
  }
}
