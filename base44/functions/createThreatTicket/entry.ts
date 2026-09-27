import { createClientFromRequest } from 'npm:@base44/sdk@0.8.49';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { threat_id, recipient_email } = body;
    if (!threat_id) return Response.json({ error: 'threat_id is required' }, { status: 400 });

    // Get the threat
    const threat = await base44.entities.Threat.get(threat_id);
    if (!threat) return Response.json({ error: 'Threat not found' }, { status: 404 });

    // Already has a ticket
    if (threat.ticket_created && threat.ticket_url) {
      return Response.json({
        success: true,
        ticket_key: threat.ticket_name,
        ticket_url: threat.ticket_url,
        message: 'Ticket already exists'
      });
    }

    // Get products and match affected ones
    const products = await base44.entities.Product.list();
    const affectedStr = (threat.affected_products || '').toLowerCase();
    const matchedProducts = products.filter(p => {
      const name = (p.name || '').toLowerCase();
      return name && affectedStr.includes(name);
    });

    // Get Jira connection
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('jira');

    // Get cloudId
    const resourcesRes = await fetch('https://api.atlassian.com/oauth/token/accessible-resources', {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' }
    });
    if (!resourcesRes.ok) return Response.json({ error: 'Failed to get Jira resources' }, { status: 500 });
    const resources = await resourcesRes.json();
    if (!resources || resources.length === 0) return Response.json({ error: 'No Jira sites found' }, { status: 400 });
    const cloudId = resources[0].id;
    const siteUrl = resources[0].url;

    // Get first project
    const projectsRes = await fetch(`https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/project/search`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' }
    });
    if (!projectsRes.ok) return Response.json({ error: 'Failed to get Jira projects' }, { status: 500 });
    const projectsData = await projectsRes.json();
    const projects = projectsData.values || [];
    if (projects.length === 0) return Response.json({ error: 'No Jira projects found' }, { status: 400 });
    const projectKey = projects[0].key;

    // Build ADF description
    const descContent = [];
    const addPara = (text) => descContent.push({ type: 'paragraph', content: [{ type: 'text', text }] });
    addPara(`Severity: ${threat.severity}`);
    addPara(`Type: ${threat.type}`);
    addPara(`Status: ${threat.status}`);
    if (threat.cve_id) addPara(`CVE: ${threat.cve_id}`);
    if (threat.cvss_score != null) addPara(`CVSS: ${threat.cvss_score}`);
    if (threat.epss_score != null) addPara(`EPSS: ${threat.epss_score}`);
    if (threat.description) addPara(`Description: ${threat.description}`);
    if (threat.source) addPara(`Source: ${threat.source}`);
    if (threat.source_url) addPara(`Source URL: ${threat.source_url}`);
    if (matchedProducts.length > 0) {
      addPara('Affected Products & Business Units:');
      matchedProducts.forEach(p => {
        addPara(`  • ${p.name} (Vendor: ${p.vendor || 'N/A'}) — Owner: ${p.owner || 'N/A'}`);
      });
    }

    // Create Jira issue
    const issueRes = await fetch(`https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/issue`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({
        fields: {
          project: { key: projectKey },
          summary: `[ThreatPulse] ${threat.title}`,
          description: { type: 'doc', version: 1, content: descContent },
          issuetype: { name: 'Task' }
        }
      })
    });
    if (!issueRes.ok) {
      const errText = await issueRes.text();
      return Response.json({ error: `Jira API error: ${errText}` }, { status: 500 });
    }
    const issue = await issueRes.json();
    const ticketUrl = `${siteUrl}/browse/${issue.key}`;

    // Update threat with ticket info
    await base44.entities.Threat.update(threat_id, {
      ticket_name: issue.key,
      ticket_url: ticketUrl,
      ticket_created: true,
    });

    // Create activity
    await base44.entities.ThreatActivity.create({
      threat_id,
      action: 'note',
      description: `Jira ticket created: ${issue.key} by ${user.full_name || user.email}`,
      actor_name: user.full_name || user.email,
    });

    // Send email with all details
    if (recipient_email) {
      const lines = [
        'ThreatPulse — Threat Ticket Created',
        '',
        'A Jira ticket has been created for the following threat.',
        '',
        'THREAT DETAILS',
        '==============',
        `Title: ${threat.title}`,
        `Severity: ${threat.severity}`,
        `Type: ${threat.type}`,
        `Status: ${threat.status}`,
      ];
      if (threat.cve_id) lines.push(`CVE ID: ${threat.cve_id}`);
      if (threat.cvss_score != null) lines.push(`CVSS Score: ${threat.cvss_score}`);
      if (threat.epss_score != null) lines.push(`EPSS Score: ${threat.epss_score}`);
      if (threat.source) lines.push(`Source: ${threat.source}`);
      if (threat.source_url) lines.push(`Source URL: ${threat.source_url}`);
      lines.push('', 'Description:', threat.description || 'N/A', '');
      if (matchedProducts.length > 0) {
        lines.push('AFFECTED PRODUCTS & BUSINESS UNITS', '===================================');
        matchedProducts.forEach(p => {
          lines.push(`• ${p.name} (Vendor: ${p.vendor || 'N/A'}) — Business Unit Owner: ${p.owner || 'N/A'}`);
        });
        lines.push('');
      }
      lines.push('JIRA TICKET', '===========');
      lines.push(`Ticket: ${issue.key}`, `URL: ${ticketUrl}`, '');
      const origin = req.headers.get('origin') || '';
      if (origin) {
        lines.push('View this threat in ThreatPulse:');
        lines.push(`${origin}/threats/${threat_id}`);
      }
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: recipient_email,
          subject: `[ThreatPulse] ${threat.title} — Jira ticket ${issue.key} created`,
          body: lines.join('\n'),
        });
      } catch (emailErr) {
        // Email failed but ticket was created — don't fail the whole request
      }
    }

    return Response.json({
      success: true,
      ticket_key: issue.key,
      ticket_url: ticketUrl
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}