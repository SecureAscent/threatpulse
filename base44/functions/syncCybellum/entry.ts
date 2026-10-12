import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { syncConnection } from '../../shared/cybellumSync.ts';

// Per-tenant Cybellum sync. Reads the calling user's organization's enabled
// CybellumConnection and pulls three resource kinds into ThreatPulse via the
// shared syncConnection helper (also used by the scheduled syncAllCybellumConnections):
//   1. Cybellum assets/products  -> Product (org-scoped, sbom_enrolled=true)
//   2. Cybellum SBOM components  -> SbomRecord (org-scoped, source='cybellum')
//   3. Cybellum vulnerability findings (with a CVE) -> Threat (global, source='Cybellum')

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Resolve the user's organization (mirror getJiraWebhookSetup)
    let orgId = user.data?.organization_id;
    let org = null;
    if (orgId) {
      try { org = await base44.asServiceRole.entities.Organization.get(orgId); } catch (_) { /* not found */ }
    }
    if (!org) {
      const orgPage = await base44.asServiceRole.entities.Organization.filter({}, { limit: 200 });
      org = (orgPage?.items || []).find((o) => (o.members || []).includes(user.id));
      orgId = org?.id || orgId;
    }
    if (!org) {
      return Response.json({ error: 'No organization found. Ask your admin to add you to an organization first.' }, { status: 404 });
    }

    // Find the org's enabled Cybellum connection
    const connPage = await base44.entities.CybellumConnection.filter(
      { organization_id: org.id, enabled: true },
      { sort: '-created_date', limit: 10 }
    );
    const conn = (connPage?.items || [])[0];
    if (!conn) {
      return Response.json({ error: 'No enabled Cybellum connection for your organization. Add one on the Integrations page first.' }, { status: 404 });
    }

    // Run the shared sync logic (also used by the scheduled syncAllCybellumConnections)
    const result = await syncConnection(base44, conn, org);

    await base44.entities.CybellumConnection.update(conn.id, {
      last_synced_date: new Date().toISOString(),
      last_sync_summary: result.summary,
      last_test_status: 'success',
      last_error: ''
    });

    return Response.json({
      status: 'success',
      organization: org.name,
      products: result.products,
      sbom_components: result.sbom_components,
      vulnerability_findings: result.vulnerability_findings,
      summary: result.summary
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}