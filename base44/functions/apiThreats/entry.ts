import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// Per-plan daily request limits for the customer-facing API.
const PLAN_LIMITS = {
  free: 1000,
  smb: 10000,
  enterprise: 100000,
  self_hosted: 999999999,
};

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const auth = req.headers.get('authorization') || '';
    const token = auth.replace(/^Bearer\s+/i, '').trim();
    if (!token) return Response.json({ error: 'Missing API key' }, { status: 401 });

    // Validate the API key by hash
    const hash = await sha256(token);
    const keyPage = await base44.asServiceRole.entities.ApiKey.filter({ key_hash: hash, active: true }, { limit: 1 });
    const key = keyPage && keyPage.items && keyPage.items[0];
    if (!key) return Response.json({ error: 'Invalid or revoked API key' }, { status: 401 });
    if (key.expires_at && new Date(key.expires_at) < new Date()) {
      return Response.json({ error: 'API key expired' }, { status: 401 });
    }

    // Determine plan-based daily limit
    let limit = PLAN_LIMITS.free;
    if (key.organization_id) {
      try {
        const org = await base44.asServiceRole.entities.Organization.get(key.organization_id);
        if (org && org.plan && PLAN_LIMITS[org.plan] != null) limit = PLAN_LIMITS[org.plan];
      } catch (_) { /* default to free */ }
    }

    // Meter usage for today
    const today = new Date().toISOString().slice(0, 10);
    const usagePage = await base44.asServiceRole.entities.ApiUsage.filter({ api_key_id: key.id, date: today }, { limit: 1 });
    const existing = usagePage && usagePage.items && usagePage.items[0];
    const currentCount = (existing?.count || 0) + 1;

    if (currentCount > limit) {
      return Response.json({ error: 'Daily rate limit exceeded', limit, usage_today: currentCount - 1 }, { status: 429 });
    }

    if (existing) {
      await base44.asServiceRole.entities.ApiUsage.update(existing.id, { count: currentCount, last_request: new Date().toISOString() });
    } else {
      await base44.asServiceRole.entities.ApiUsage.create({ api_key_id: key.id, date: today, count: currentCount, last_request: new Date().toISOString() });
    }

    // Update key last-used timestamp
    try { await base44.asServiceRole.entities.ApiKey.update(key.id, { last_used_date: new Date().toISOString() }); } catch (_) { /* best-effort */ }

    // Check scope
    const scopes = (key.scopes || '').split(',').map((s) => s.trim());
    if (!scopes.includes('read:threats')) {
      return Response.json({ error: 'Insufficient scope: read:threats required' }, { status: 403 });
    }

    // Parse query params
    const url = new URL(req.url);
    const limitParam = Math.min(Number(url.searchParams.get('limit')) || 50, 200);
    const severity = url.searchParams.get('severity');
    const query = severity ? { severity } : {};

    const tPage = await base44.asServiceRole.entities.Threat.filter(query, {
      sort: '-created_date',
      limit: limitParam,
      fields: ['title', 'severity', 'type', 'cve_id', 'cvss_score', 'epss_score', 'risk_score', 'source', 'source_url', 'affected_products', 'status', 'created_date'],
    });

    return Response.json({
      data: (tPage && tPage.items) || [],
      meta: {
        count: ((tPage && tPage.items) || []).length,
        remaining: limit - currentCount,
        limit,
        usage_today: currentCount,
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}