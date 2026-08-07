import { prisma } from '@/lib/db';
import type { TenantContext } from '@/lib/tenant-context';

/**
 * Append an entry to the audit trail. Never throws — auditing must not break
 * the operation it is recording. Failures are logged to the console instead.
 */
export interface AuditEventInput {
  action: string; // e.g. "mfa.enabled", "apikey.created"
  ctx?: TenantContext | null;
  organizationId?: string | null;
  userId?: string | null;
  actorEmail?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
}

export async function writeAuditEvent(input: AuditEventInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action: input.action,
        organizationId: input.organizationId ?? input.ctx?.organizationId ?? null,
        userId: input.userId ?? input.ctx?.userId ?? null,
        actorEmail: input.actorEmail ?? input.ctx?.email ?? null,
        targetType: input.targetType ?? null,
        targetId: input.targetId ?? null,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
        ipAddress: input.ipAddress ?? null,
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[audit] failed to write event', input.action, err);
  }
}
