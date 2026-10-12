import { createClientFromRequest } from 'npm:@base44/sdk@0.8.49';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action, threat_id, summary, assignee, comment } = body;
    if (!threat_id) return Response.json({ error: 'threat_id is required' }, { status: 400 });
    if (!action || !['update', 'close'].includes(action)) {
      return Response.json({ error: 'action must be "update" or "close"' }, { status: 400 });
    }

    const threat = await base44.entities.Threat.get(threat_id);
    if (!threat) return Response.json({ error: 'Threat not found' }, { status: 404 });
    if (!threat.ticket_name) return Response.json({ error: 'No Jira ticket linked to this threat' }, { status: 400 });

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('jira');

    const resourcesRes = await fetch('https://api.atlassian.com/oauth/token/accessible-resources', {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' }
    });
    if (!resourcesRes.ok) return Response.json({ error: 'Failed to get Jira resources' }, { status: 502 });
    const resources = await resourcesRes.json();
    if (!resources?.length) return Response.json({ error: 'No Jira sites found' }, { status: 400 });
    const cloudId = resources[0].id;

    const issueKey = threat.ticket_name;
    const apiBase = `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3`;
    const authHeaders = { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' };
    const actorName = user.full_name || user.email || 'Unknown Analyst';

    const adfText = (text) => ({ type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] });

    if (action === 'update') {
      const fields = {};
      if (summary && summary.trim()) fields.summary = summary.trim();
      if (assignee && assignee.trim()) fields.assignee = { accountId: assignee.trim() };

      if (Object.keys(fields).length > 0) {
        const res = await fetch(`${apiBase}/issue/${issueKey}`, {
          method: 'PUT',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ fields })
        });
        if (!res.ok) {
          const errText = await res.text();
          return Response.json({ error: `Jira update failed: ${errText}` }, { status: 502 });
        }
      }

      if (comment && comment.trim()) {
        const res = await fetch(`${apiBase}/issue/${issueKey}/comment`, {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ body: adfText(comment.trim()) })
        });
        if (!res.ok) {
          const errText = await res.text();
          return Response.json({ error: `Jira comment failed: ${errText}` }, { status: 502 });
        }
      }

      await base44.entities.ThreatActivity.create({
        threat_id,
        action: 'note',
        description: `Jira ticket ${issueKey} updated by ${actorName}`,
        actor_name: actorName,
      });

      return Response.json({ success: true, ticket_key: issueKey });
    }

    if (action === 'close') {
      const transRes = await fetch(`${apiBase}/issue/${issueKey}/transitions`, { headers: authHeaders });
      if (!transRes.ok) return Response.json({ error: 'Failed to fetch Jira transitions' }, { status: 502 });
      const transData = await transRes.json();
      const transitions = transData.transitions || [];

      const doneTrans =
        transitions.find(t => t.to?.statusCategory?.key === 'done') ||
        transitions.find(t => /done|closed|resolved|complete/i.test(t.name)) ||
        transitions.find(t => /done|closed|resolved|complete/i.test(t.to?.name || ''));

      if (!doneTrans) return Response.json({ error: 'No close/done transition available for this ticket' }, { status: 400 });

      const closeBody = { transition: { id: doneTrans.id } };
      if (comment && comment.trim()) {
        closeBody.update = {
          comment: [{ add: { body: adfText(comment.trim()) } }]
        };
      }

      const res = await fetch(`${apiBase}/issue/${issueKey}/transitions`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(closeBody)
      });
      if (!res.ok) {
        const errText = await res.text();
        return Response.json({ error: `Jira close failed: ${errText}` }, { status: 502 });
      }

      await base44.entities.Threat.update(threat_id, {
        status: 'Mitigated',
        closed_date: new Date().toISOString(),
      });

      await base44.entities.ThreatActivity.create({
        threat_id,
        action: 'status_change',
        description: `Jira ticket ${issueKey} closed → threat mitigated by ${actorName}`,
        old_value: threat.status,
        new_value: 'Mitigated',
        actor_name: actorName,
      });

      return Response.json({ success: true, ticket_key: issueKey, mitigated: true });
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}