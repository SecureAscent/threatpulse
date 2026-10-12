import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// Returns the tenant-specific base URLs needed to build per-CVE hyperlinks in
// the vulnerability inbox CSV export:
//   - Jira site URL + first project key (via the Jira connector)
//   - Cybellum base URL (from the user's org CybellumConnection)
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Cybellum base URL from the user's org connection(s)
    let cybellum_base_url = null;
    try {
      const orgId = user.data?.organization_id;
      const query = orgId ? { organization_id: orgId, enabled: true } : { enabled: true };
      const connPage = await base44.asServiceRole.entities.CybellumConnection.filter(query, { limit: 1 });
      const conn = connPage?.items?.[0];
      if (conn?.base_url) cybellum_base_url = conn.base_url.replace(/\/+$/, '');
    } catch (_) { /* ignore */ }

    // Default to the reference Cybellum tenant when no connection is configured.
    if (!cybellum_base_url) cybellum_base_url = 'https://abbott.cybellum.com';

    // Jira site URL + project key via the Jira connector
    let jira_site_url = null;
    let jira_project_key = null;
    try {
      const { accessToken } = await base44.asServiceRole.connectors.getConnection('jira');
      const resourcesRes = await fetch('https://api.atlassian.com/oauth/token/accessible-resources', {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
      });
      if (resourcesRes.ok) {
        const resources = await resourcesRes.json();
        if (resources && resources.length > 0) {
          jira_site_url = (resources[0].url || '').replace(/\/+$/, '');
          const cloudId = resources[0].id;
          const projectsRes = await fetch(`https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/project/search`, {
            headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
          });
          if (projectsRes.ok) {
            const projectsData = await projectsRes.json();
            const projects = projectsData.values || [];
            if (projects.length > 0) jira_project_key = projects[0].key;
          }
        }
      }
    } catch (_) { /* ignore */ }

    return Response.json({
      status: 'success',
      jira_site_url,
      jira_project_key,
      cybellum_base_url,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}