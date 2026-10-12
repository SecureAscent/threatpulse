import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// Validates per-tenant Cybellum credentials by probing the account/whoami endpoint.
// Cybellum's REST API is tenant-specific; we try a few common paths and accept any 2xx
// that returns a JSON profile. 401/403 = bad credentials, 404 = wrong base path.
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const baseUrl = (body?.base_url || '').trim().replace(/\/$/, '');
    const apiToken = body?.api_token || '';

    if (!baseUrl || !apiToken) {
      return Response.json({ error: 'base_url and api_token are required' }, { status: 400 });
    }

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${apiToken}`,
      'Accept': 'application/json',
      'User-Agent': 'ThreatPulse/1.0 (security-monitoring)'
    };

    // Probe a few likely account/profile paths across Cybellum API versions.
    const paths = [
      '/api/v1/me',
      '/api/v1/account',
      '/api/v1/user/me',
      '/api/v2/me',
      '/api/v2/account'
    ];

    let lastError = '';
    let profile: any = null;

    for (const path of paths) {
      try {
        const res = await fetch(`${baseUrl}${path}`, { method: 'GET', headers });
        if (res.ok) {
          const text = await res.text();
          try { profile = text ? JSON.parse(text) : {}; } catch { profile = {}; }
          break;
        }
        if (res.status === 401 || res.status === 403) {
          lastError = 'Authentication failed — check your API token.';
          break;
        }
        if (res.status === 404) {
          lastError = `Endpoint not found (${path})`;
          continue;
        }
        lastError = `Cybellum returned ${res.status}`;
      } catch (e: any) {
        lastError = e.message || 'Network error reaching Cybellum';
      }
    }

    if (profile) {
      const key = profile.id || profile.accountId || profile.userId || profile.username || profile.email || null;
      return Response.json({
        status: 'success',
        user_key: key,
        display_name: profile.displayName || profile.name || profile.fullName || null,
        email: profile.email || null
      });
    }

    return Response.json({ status: 'failed', error: lastError || 'Could not verify credentials' }, { status: 200 });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}