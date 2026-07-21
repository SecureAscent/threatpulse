export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { writeAuditEvent } from '@/lib/audit';
import { resolveAssetConnector } from '@/lib/connectors/bootstrap';
import { syncAssetConnector } from '@/lib/connectors/sync-asset-connector';
import type { SyncMode } from '@/lib/connectors/types';
import { getTenantContext, hasPermission } from '@/lib/tenant-context';

const SYNC_MODES = new Set<SyncMode>(['INCREMENTAL', 'FULL', 'DRY_RUN']);

function parseSyncMode(value: unknown): SyncMode {
  const mode = String(value || 'INCREMENTAL').toUpperCase() as SyncMode;
  if (!SYNC_MODES.has(mode)) {
    throw new Error('Invalid sync mode. Use INCREMENTAL, FULL, or DRY_RUN.');
  }
  return mode;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const context = await getTenantContext();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!hasPermission(context, 'integrations.manage')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const integration = await prisma.integrationConfig.findFirst({
      where: {
        id: params.id,
        organizationId: context.organizationId,
      },
      select: {
        id: true,
        integrationId: true,
      },
    });

    if (!integration) {
      return NextResponse.json({ error: 'Integration not found' }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const mode = parseSyncMode(body?.mode);
    const connector = resolveAssetConnector(integration.integrationId);

    const result = await syncAssetConnector(prisma, {
      organizationId: context.organizationId,
      integrationConfigId: integration.id,
      connector,
      mode,
      signal: request.signal,
    });

    await writeAuditEvent({
      context,
      action: 'integration.synced',
      entityType: 'IntegrationConfig',
      entityId: integration.id,
      metadata: {
        provider: connector.id,
        mode,
        syncRunId: result.syncRunId,
        recordsRead: result.recordsRead,
        recordsCreated: result.recordsCreated,
        recordsUpdated: result.recordsUpdated,
        recordsFailed: result.recordsFailed,
      },
    });

    return NextResponse.json({ result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Integration sync failed.';
    const status = message.startsWith('Invalid sync mode') ? 400 : 500;
    console.error('POST integration sync error:', error);
    return NextResponse.json({ error: message }, { status });
  }
}
