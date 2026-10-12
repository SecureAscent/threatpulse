import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Validates Confluence credentials by hitting the "current user" endpoint.
// Supports both Confluence Cloud (atlassian.net) and Server / Data Center.
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const baseUrl = (body?.base_url || '').trim().replace(/\/$/, '');
    const email = (body?.email || '').trim();
    const apiToken = body?.api_token || '';

    if (!baseUrl || !email || !apiToken) {
      return Response.json({ error: 'base_url, email, and api_token are required' }, { status: 400 });
    }

    const authHeader = 'Basic ' + btoa(`${email}:${apiToken}`);
    const isCloud = baseUrl.includes('atlassian.net');
    const paths = isCloud
      ? ['/wiki/rest/api/user/current']
      : ['/rest/api/user/current', '/wiki/rest/api/user/current'];

    let lastError = '';
    let profile = null;

    for (const path of paths) {
      try {
        const res = await fetch(`${baseUrl}${path}`, {
          method: 'GET',
          headers: {
            'Authorization': authHeader,
            'Accept': 'application/json',
            'User-Agent': 'ThreatPulse/1.0 (security-monitoring)'
          }
        });
        if (res.ok) {
          profile = await res.json();
          break;
        }
        if (res.status === 401 || res.status === 403) {
          lastError = 'Authentication failed — check your email and API token.';
          break;
        }
        if (res.status === 404) {
          lastError = `Endpoint not found (${path})`;
          continue;
        }
        lastError = `Confluence returned ${res.status}`;
      } catch (e) {
        lastError = e.message || 'Network error reaching Confluence';
      }
    }

    if (profile) {
      return Response.json({
        status: 'success',
        user_key: profile.accountId || profile.userKey || profile.username || null,
        display_name: profile.displayName || profile.fullName || null,
        email: profile.email || email
      });
    }

    return Response.json({ status: 'failed', error: lastError || 'Could not verify credentials' }, { status: 200 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}