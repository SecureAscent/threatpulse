import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    let body = {};
    try { body = await req.json(); } catch (_) { body = {}; }
    const threatId = body.threat_id;
    if (!threatId) return Response.json({ error: 'threat_id required' }, { status: 400 });

    const threat = await base44.asServiceRole.entities.Threat.get(threatId);
    if (!threat) return Response.json({ error: 'threat not found' }, { status: 404 });

    const haystack = `${threat.title || ''} ${threat.description || ''} ${threat.affected_products || ''} ${threat.cve_id || ''}`.toLowerCase();

    // Load enabled tenant watchlists
    const wlPage = await base44.asServiceRole.entities.TenantWatchlist.filter({ enabled: true }, { limit: 500 });
    const watchlists = (wlPage && wlPage.items) || [];

    const matched = [];
    for (const wl of watchlists) {
      const terms = (wl.terms || '').split(/[\n,;]/).map((s) => s.trim().toLowerCase()).filter(Boolean);
      const hits = terms.filter((t) => haystack.includes(t));
      if (hits.length > 0) {
        matched.push({ watchlist: wl.name, kind: wl.kind, terms: hits, owner: wl.owner_name, created_by_id: wl.created_by_id });
      }
    }

    if (matched.length === 0) return Response.json({ status: 'success', matched: 0, alerts_sent: 0 });

    // Collect alert recipients: watchlist creators + org escalation email
    const emails = new Set();
    const slaPage = await base44.asServiceRole.entities.SLAPolicy.filter({ active: true }, { limit: 10 });
    (slaPage && slaPage.items || []).forEach((s) => { if (s.escalation_email) emails.add(s.escalation_email); });

    for (const m of matched) {
      if (m.created_by_id) {
        try {
          const u = await base44.asServiceRole.entities.User.get(m.created_by_id);
          if (u && u.email) emails.add(u.email);
        } catch (_) { /* best-effort */ }
      }
    }

    const origin = new URL(req.url).origin;
    const subject = `ThreatPulse Alert: "${(threat.title || '').slice(0, 80)}" matched ${matched.length} watchlist${matched.length > 1 ? 's' : ''}`;
    const bodyText = `A new threat matched your watchlist(s):\n\nThreat: ${threat.title}\nSeverity: ${threat.severity}\nCVE: ${threat.cve_id || 'N/A'}\nSource: ${threat.source || 'N/A'}\n\nMatched watchlists:\n${matched.map((m) => `  - ${m.watchlist} (${m.kind}): ${m.terms.join(', ')}`).join('\n')}\n\nReview it: ${origin}/threats/${threat.id}\n`;

    let sent = 0;
    for (const email of emails) {
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({ to: email, subject, body: bodyText });
        sent++;
      } catch (_) { /* best-effort */ }
    }

    return Response.json({ status: 'success', matched: matched.length, alerts_sent: sent });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}