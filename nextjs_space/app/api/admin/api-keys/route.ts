export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext, isAdmin } from '@/lib/tenant-context';
import { prisma } from '@/lib/db';
import { generateApiKey } from '@/lib/crypto';
import { writeAuditEvent } from '@/lib/audit';
import { getClientIp } from '@/lib/rate-limit';
import { AVAILABLE_SCOPES } from '@/lib/api-key-scopes';

function serialize(key: any) {
  const now = Date.now();
  const status = key.revokedAt
    ? 'REVOKED'
    : key.expiresAt && new Date(key.expiresAt).getTime() < now
      ? 'EXPIRED'
      : 'ACTIVE';
  return {
    id: key.id,
    name: key.name,
    keyPrefix: key.keyPrefix,
    scopes: key.scopes,
    lastUsedAt: key.lastUsedAt,
    expiresAt: key.expiresAt,
    revokedAt: key.revokedAt,
    createdAt: key.createdAt,
    status,
  };
}

export async function GET(req: NextRequest) {
  const ctx = await getTenantContext(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(ctx)) return NextResponse.json({ error: 'Admin privileges required' }, { status: 403 });
  if (!ctx.organizationId) return NextResponse.json({ keys: [] });

  const keys = await prisma.apiKey.findMany({
    where: { organizationId: ctx.organizationId },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({ keys: keys.map(serialize) });
}

export async function POST(req: NextRequest) {
  const ctx = await getTenantContext(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(ctx)) return NextResponse.json({ error: 'Admin privileges required' }, { status: 403 });
  if (!ctx.organizationId || !ctx.userId) {
    return NextResponse.json({ error: 'No organization context' }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const name = (body?.name || '').toString().trim();
  const scopesInput: string[] = Array.isArray(body?.scopes) ? body.scopes : [];
  const expiresInDays = Number(body?.expiresInDays) || 0;

  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

  const scopes = scopesInput.filter((s) => (AVAILABLE_SCOPES as readonly string[]).includes(s));
  if (scopes.length === 0) {
    return NextResponse.json({ error: 'Select at least one valid scope' }, { status: 400 });
  }

  const { fullKey, keyPrefix, keyHash } = generateApiKey();
  const expiresAt = expiresInDays > 0 ? new Date(Date.now() + expiresInDays * 86400_000) : null;

  const created = await prisma.apiKey.create({
    data: {
      organizationId: ctx.organizationId,
      createdById: ctx.userId,
      name,
      keyPrefix,
      keyHash,
      scopes,
      expiresAt,
    },
  });

  await writeAuditEvent({
    action: 'apikey.created',
    ctx,
    targetType: 'ApiKey',
    targetId: created.id,
    metadata: { name, scopes },
    ipAddress: getClientIp(req.headers),
  });

  // Return the full key ONCE — it is never retrievable again.
  return NextResponse.json({ key: serialize(created), fullKey }, { status: 201 });
}
