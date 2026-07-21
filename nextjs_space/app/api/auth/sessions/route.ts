export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/tenant-context';
import { prisma } from '@/lib/db';
import { randomToken } from '@/lib/crypto';
import { getClientIp } from '@/lib/rate-limit';
import { writeAuditEvent } from '@/lib/audit';

const SESSION_COOKIE = 'tp_sid';

/** List the current user's active (non-revoked) sessions. */
export async function GET(req: NextRequest) {
  const ctx = await getTenantContext();
  if (!ctx || !ctx.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const currentToken = req.cookies.get(SESSION_COOKIE)?.value ?? null;

  const sessions = await prisma.activeSession.findMany({
    where: { userId: ctx.userId, revokedAt: null },
    orderBy: { lastSeenAt: 'desc' },
  });

  return NextResponse.json({
    sessions: sessions.map((s) => ({
      id: s.id,
      userAgent: s.userAgent,
      ipAddress: s.ipAddress,
      lastSeenAt: s.lastSeenAt,
      createdAt: s.createdAt,
      current: !!currentToken && s.sessionToken === currentToken,
    })),
  });
}

/**
 * Register a session record for the signed-in user. Called by the login form
 * immediately after a successful `signIn`. Sets an httpOnly cookie so the
 * session list can flag the current device.
 */
export async function POST(req: NextRequest) {
  const ctx = await getTenantContext();
  if (!ctx || !ctx.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Reuse an existing cookie token if present, otherwise mint a new one.
  let token = req.cookies.get(SESSION_COOKIE)?.value;
  const userAgent = req.headers.get('user-agent') || 'Unknown device';
  const ipAddress = getClientIp(req.headers);

  if (token) {
    const existing = await prisma.activeSession.findUnique({ where: { sessionToken: token } });
    if (existing && existing.userId === ctx.userId && !existing.revokedAt) {
      await prisma.activeSession.update({
        where: { id: existing.id },
        data: { lastSeenAt: new Date(), userAgent, ipAddress },
      });
      return NextResponse.json({ success: true, id: existing.id });
    }
    token = undefined; // stale/foreign token — replace it
  }

  const newToken = randomToken(24);
  const created = await prisma.activeSession.create({
    data: { userId: ctx.userId, sessionToken: newToken, userAgent, ipAddress },
  });

  await writeAuditEvent({
    action: 'session.created',
    ctx,
    targetType: 'ActiveSession',
    targetId: created.id,
    metadata: { userAgent },
    ipAddress,
  });

  const res = NextResponse.json({ success: true, id: created.id });
  res.cookies.set(SESSION_COOKIE, newToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return res;
}
