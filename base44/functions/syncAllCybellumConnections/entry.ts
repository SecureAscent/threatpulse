import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { syncConnection } from '../../shared/cybellumSync.ts';

// Scheduled Cybellum sync — iterates ALL enabled CybellumConnection records
// across every organization and syncs each one. Runs as service role (no user
// session needed), so it works from a scheduled workflow.
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);

    // List all enabled connections (service role bypasses RLS)
    const connPage = await base44.asServiceRole.entities.CybellumConnection.filter(
      { enabled: true },
      { sort: '-created_date', limit: 200 }
    );
    const connections = connPage?.items || [];

    if (connections.length === 0) {
      return Response.json({ status: 'success', connections: 0, results: [], message: 'No enabled Cybellum connections found.' });
    }

    // Collect unique org IDs to resolve org names
    const orgIds = [...new Set(connections.map((c) => c.organization_id).filter(Boolean))];
    const orgs = new Map();
    for (const orgId of orgIds) {
      try {
        const org = await base44.asServiceRole.entities.Organization.get(orgId);
        if (org) orgs.set(orgId, org);
      } catch { /* org may have been deleted */ }
    }

    const results = [];
    let totalProducts = 0;
    let totalSbom = 0;
    let totalFindings = 0;
    let failures = 0;

    for (const conn of connections) {
      const org = orgs.get(conn.organization_id);
      if (!org) {
        results.push({ connection_id: conn.id, organization_id: conn.organization_id, status: 'skipped', error: 'Organization not found' });
        failures++;
        continue;
      }
      try {
        const result = await syncConnection(base44.asServiceRole, conn, org);
        totalProducts += result.products;
        totalSbom += result.sbom_components;
        totalFindings += result.vulnerability_findings;

        await base44.asServiceRole.entities.CybellumConnection.update(conn.id, {
          last_synced_date: new Date().toISOString(),
          last_sync_summary: result.summary,
          last_test_status: 'success',
          last_error: '',
        });

        results.push({
          connection_id: conn.id,
          organization: org.name,
          status: 'success',
          ...result,
        });
      } catch (error: any) {
        failures++;
        await base44.asServiceRole.entities.CybellumConnection.update(conn.id, {
          last_synced_date: new Date().toISOString(),
          last_test_status: 'failed',
          last_error: error?.message || 'Sync failed',
        });
        results.push({
          connection_id: conn.id,
          organization: org.name,
          status: 'failed',
          error: error?.message || 'Sync failed',
        });
      }
    }

    return Response.json({
      status: failures === connections.length ? 'failed' : 'success',
      connections: connections.length,
      succeeded: connections.length - failures,
      failed: failures,
      totals: {
        products: totalProducts,
        sbom_components: totalSbom,
        vulnerability_findings: totalFindings,
      },
      results,
    });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}