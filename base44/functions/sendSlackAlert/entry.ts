import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    let body = {};
    try { body = await req.json(); } catch (_) { body = {}; }

    const threatId = body.threat_id;
    const channel = body.channel || Deno.env.get('SLACK_ALERT_CHANNEL');
    if (!channel) return Response.json({ error: 'No SLACK_ALERT_CHANNEL configured' }, { status: 400 });
    if (!threatId) return Response.json({ error: 'threat_id required' }, { status: 400 });

    const threat = await base44.asServiceRole.entities.Threat.get(threatId);
    if (!threat) return Response.json({ error: 'Threat not found' }, { status: 404 });

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('slackbot');

    const lines = [
      `🚨 *${threat.severity} threat — ${threat.status}*`,
      `*${threat.title}*`,
    ];
    if (threat.cve_id) lines.push(`*CVE:* ${threat.cve_id}`);
    if (threat.cvss_score != null) lines.push(`*CVSS:* ${threat.cvss_score}`);
    lines.push(`*Source:* ${threat.source || 'n/a'}`);
    if (threat.affected_products) lines.push(`*Affected:* ${threat.affected_products}`);
    if (threat.description) lines.push(`\n${threat.description.slice(0, 280)}`);
    lines.push(`\n🔍 <https://threatpulseintel.com/threats/${threat.id}|Open investigation>`);

    const res = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify({
        channel,
        text: lines.join('\n'),
        username: 'ThreatPulse',
        icon_emoji: ':rotating_light:',
      }),
    });
    const data = await res.json();
    if (!data.ok) return Response.json({ error: `Slack error: ${data.error}` }, { status: 502 });

    return Response.json({ status: 'success', channel, ts: data.ts, threat_id: threat.id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}