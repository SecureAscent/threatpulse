export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext, isAdmin } from '@/lib/tenant-context';

/**
 * POST /api/admin/collector-health/trigger  (ADMIN+)
 *
 * Asks the collector service to run a collection cycle immediately. Talks to
 * the collector's lightweight HTTP control server (see collector/src/control.ts)
 * over the internal docker network. Optionally scoped to a single source via
 * the `source` query param or JSON body.
 *
 * Fails soft: if the collector is unreachable (e.g. not running in dev) we
 * return a 502 with a friendly message rather than throwing.
 */
const CONTROL_URL = process.env.COLLECTOR_CONTROL_URL || 'http://collector:9464';
const CONTROL_TOKEN = process.env.COLLECTOR_CONTROL_TOKEN || '';

export async function POST(req: NextRequest) {
  const ctx = await getTenantContext(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(ctx)) {
    return NextResponse.json({ error: 'Admin privileges required' }, { status: 403 });
  }

  // Determine requested source (optional).
  let source = req.nextUrl.searchParams.get('source') || '';
  if (!source) {
    try {
      const body = await req.json();
      if (body && typeof body.source === 'string') source = body.source;
    } catch {
      /* no body — full run */
    }
  }

  const url = new URL('/run', CONTROL_URL);
  if (source) url.searchParams.set('source', source);

  // The collector acknowledges immediately (202) and runs the cycle in the
  // background, so this call returns fast. A short timeout is plenty and keeps
  // the UI responsive if the collector is genuinely unreachable.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(url.toString(), {
      method: 'POST',
      headers: CONTROL_TOKEN ? { 'x-collector-token': CONTROL_TOKEN } : undefined,
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json(
        { error: data?.error || `Collector responded with ${res.status}` },
        { status: 502 },
      );
    }
    return NextResponse.json({ ok: true, ...data });
  } catch (err: any) {
    const reason =
      err?.name === 'AbortError'
        ? 'Collector did not respond in time'
        : 'Collector service is unreachable';
    return NextResponse.json(
      { error: reason, detail: String(err?.message || err) },
      { status: 502 },
    );
  } finally {
    clearTimeout(timeout);
  }
}
