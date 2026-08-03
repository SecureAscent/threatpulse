import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const toDate = (s) => {
  if (!s) return null;
  const d = new Date(typeof s === 'string' ? s.replace(' ', 'T') : s);
  return isNaN(d.getTime()) ? null : d.toISOString();
};

const trunc = (s, n) => {
  const v = (s || '').toString();
  return v.length > n ? v.slice(0, n) + '…' : v;
};

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const role = (user.role || '').toLowerCase();
    if (role !== 'admin' && role !== 'superadmin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const headers = {
      Accept: 'application/json',
      'User-Agent': 'ThreatPulse/1.0 (+https://threatpulseintel.com)'
    };

    const [victimsRes, groupsRes] = await Promise.all([
      fetch('https://api.ransomware.live/v2/recentvictims', { headers }),
      fetch('https://api.ransomware.live/v2/groups', { headers })
    ]);

    if (!victimsRes.ok) {
      return Response.json({ error: `recentvictims fetch failed: ${victimsRes.status}` }, { status: 502 });
    }
    const victims = await victimsRes.json();

    let groups = [];
    let groupsError = null;
    if (groupsRes.ok) {
      groups = await groupsRes.json();
    } else {
      groupsError = `groups fetch failed: ${groupsRes.status}`;
    }

    const existing = await base44.asServiceRole.entities.ThreatActor.list('-created_date', 500);
    const seen = new Set();
    for (const r of existing) {
      if (r.kind === 'threat_actor') seen.add(`a::${(r.name || '').toLowerCase()}`);
      else seen.add(`v::${(r.ioc_value || '').toLowerCase()}::${(r.name || '').toLowerCase()}`);
    }

    const toCreate = [];
    let vSkipped = 0;
    for (const v of Array.isArray(victims) ? victims : []) {
      const group = v.group || 'Unknown';
      const victim = v.victim || v.domain || '';
      const key = `v::${victim.toLowerCase()}::${group.toLowerCase()}`;
      if (!victim || seen.has(key)) { vSkipped += 1; continue; }
      seen.add(key);
      toCreate.push({
        name: group,
        aliases: '',
        kind: 'darkweb_mention',
        ioc_value: v.domain || victim,
        ioc_type: 'victim_domain',
        threat_type: 'ransomware_leak',
        confidence: 'high',
        malware_printable: group,
        first_seen: toDate(v.attackdate),
        last_seen: toDate(v.discovered),
        source: 'Ransomware.live',
        source_url: v.url || 'https://www.ransomware.live/',
        tags: trunc([v.activity, v.country].filter(Boolean).join(', '), 200),
        reporter: group,
        notes: trunc(v.description, 300)
      });
    }

    let gSkipped = 0;
    for (const g of Array.isArray(groups) ? groups : []) {
      const name = g.name || '';
      if (!name) continue;
      const key = `a::${name.toLowerCase()}`;
      if (seen.has(key)) { gSkipped += 1; continue; }
      seen.add(key);

      let onion = '';
      if (Array.isArray(g.locations)) {
        const loc = g.locations.find((l) => (l.fqdn || '').includes('.onion'));
        onion = loc ? loc.fqdn : (g.locations[0] && g.locations[0].fqdn) || '';
      }

      const techNames = [];
      if (Array.isArray(g.ttps)) {
        for (const t of g.ttps) {
          if (Array.isArray(t.techniques)) {
            for (const tech of t.techniques) {
              if (tech.technique_name) techNames.push(tech.technique_name);
            }
          }
        }
      }

      toCreate.push({
        name,
        aliases: g.altname || '',
        kind: 'threat_actor',
        ioc_value: onion,
        ioc_type: onion ? 'onion_leak_site' : '',
        threat_type: 'ransomware_group',
        confidence: 'medium',
        malware_printable: name,
        first_seen: toDate(g.added_date),
        last_seen: null,
        source: 'Ransomware.live',
        source_url: g.url || `https://www.ransomware.live/group/${encodeURIComponent(name)}`,
        tags: trunc(techNames.join(', '), 200),
        reporter: 'Ransomware.live',
        notes: trunc(g.description, 300)
      });
    }

    let created = 0;
    for (let i = 0; i < toCreate.length; i += 500) {
      const batch = toCreate.slice(i, i + 500);
      const res = await base44.asServiceRole.entities.ThreatActor.bulkCreate(batch);
      created += Array.isArray(res) ? res.length : 0;
    }

    return Response.json({
      fetched: {
        victims: Array.isArray(victims) ? victims.length : 0,
        groups: Array.isArray(groups) ? groups.length : 0
      },
      created,
      skipped: vSkipped + gSkipped,
      groupsError
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}