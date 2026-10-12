import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// Jira issue statuses that count as "done" — auto-mitigate the linked threat.
const DONE_STATUSES = ['done', 'resolved', 'closed', 'mitigated', 'complete'];

export default async function(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token') || '';
    if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const base44 = createClientFromRequest(req);

    // Validate per-tenant webhook token against Organization records
    const orgPage = await base44.asServiceRole.entities.Organization.filter({ jira_webhook_token: token }, { limit: 1 });
    const org = orgPage?.items?.[0];
    if (!org) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const issueKey = body.issue?.key || body.issueKey || '';
    if (!issueKey) return Response.json({ status: 'ignored', reason: 'no issue key' });

    // Detect a status transition to a done state
    let toDone = false;
    const changelogItems = body.changelog?.items || [];
    for (const item of changelogItems) {
      if (item.field === 'status') {
        const toStr = (item.toString || '').toLowerCase();
        if (DONE_STATUSES.some((s) => toStr.includes(s))) toDone = true;
      }
    }
    // Fallback: check current status on issue_updated events
    if (!toDone && body.webhookEvent === 'jira:issue_updated') {
      const status = (body.issue?.fields?.status?.name || '').toLowerCase();
      if (DONE_STATUSES.some((s) => status.includes(s))) toDone = true;
    }

    if (!toDone) return Response.json({ status: 'ignored', reason: 'not a done transition' });

    // Find threats linked to this Jira issue by ticket_url containing the issue key
    const tPage = await base44.asServiceRole.entities.Threat.filter(
      { ticket_url: { $regex: issueKey, $options: 'i' }, status: { $ne: 'Mitigated' } },
      { limit: 50 }
    );
    const threats = (tPage?.items) || [];

    let updated = 0;
    const now = new Date().toISOString();
    for (const t of threats) {
      await base44.asServiceRole.entities.Threat.update(t.id, {
        status: 'Mitigated',
        closed_date: now,
      });
      await base44.asServiceRole.entities.ThreatActivity.create({
        threat_id: t.id,
        action: 'status_change',
        description: `Jira ticket ${issueKey} transitioned to Done — threat auto-mitigated by webhook`,
        old_value: t.status,
        new_value: 'Mitigated',
        actor_name: 'Jira Webhook',
      });
      updated++;
    }

    return Response.json({ status: 'success', issue_key: issueKey, threats_mitigated: updated, org: org.name });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}