import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const isIp = (v) => /^\d{1,3}(\.\d{1,3}){3}$/.test(v) || /^[0-9a-f:]+$/i.test(v);
const isHash = (v) => /^[a-f0-9]{32}$|^[a-f0-9]{40}$|^[a-f0-9]{64}$/i.test(v);
const isUrl = (v) => /^https?:\/\//i.test(v);
const isDomain = (v) => /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9-]+)+$/i.test(v) && !isIp(v);

function b64url(s) {
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let body = {};
    try { body = await req.json(); } catch (_) { body = {}; }
    const value = (body.value || '').trim();
    if (!value) return Response.json({ error: 'value required' }, { status: 400 });

    const vtKey = Deno.env.get('VIRUSTOTAL_API_KEY');
    const shodanKey = Deno.env.get('SHODAN_API_KEY');
    const gnKey = Deno.env.get('GREYNOISE_API_KEY');

    let type = 'unknown';
    if (isUrl(value)) type = 'url';
    else if (isHash(value)) type = 'hash';
    else if (isIp(value)) type = 'ip';
    else if (isDomain(value)) type = 'domain';

    const out = { value, type, sources: {} };

    if (vtKey && type !== 'unknown') {
      try {
        let vtUrl;
        if (type === 'ip') vtUrl = `https://www.virustotal.com/api/v3/ip_addresses/${value}`;
        else if (type === 'domain') vtUrl = `https://www.virustotal.com/api/v3/domains/${value}`;
        else if (type === 'hash') vtUrl = `https://www.virustotal.com/api/v3/files/${value.toLowerCase()}`;
        else if (type === 'url') vtUrl = `https://www.virustotal.com/api/v3/urls/${b64url(value)}`;
        const r = await fetch(vtUrl, { headers: { 'x-apikey': vtKey } });
        if (r.ok) {
          const d = await r.json();
          const a = d.data?.attributes || {};
          const s = a.last_analysis_stats || {};
          out.sources.virustotal = {
            malicious: s.malicious || 0,
            suspicious: s.suspicious || 0,
            harmless: s.harmless || 0,
            undetected: s.undetected || 0,
            reputation: a.reputation || 0,
            link: `https://www.virustotal.com/gui/${type === 'url' ? 'url' : type === 'hash' ? 'file' : type}/${type === 'url' ? b64url(value) : value}`,
          };
        } else { out.sources.virustotal = { error: `VT ${r.status}` }; }
      } catch (e) { out.sources.virustotal = { error: e.message }; }
    }

    if (shodanKey && type === 'ip') {
      try {
        const r = await fetch(`https://api.shodan.io/shodan/${value}?key=${shodanKey}`);
        if (r.ok) {
          const d = await r.json();
          out.sources.shodan = {
            org: d.org || null,
            isp: d.isp || null,
            os: d.os_name || null,
            ports: (d.ports || []).slice(0, 12),
            hostnames: (d.hostnames || []).slice(0, 5),
            link: `https://www.shodan.io/host/${value}`,
          };
        } else { out.sources.shodan = { error: `Shodan ${r.status}` }; }
      } catch (e) { out.sources.shodan = { error: e.message }; }
    }

    if (type === 'ip') {
      try {
        const headers = gnKey ? { key: gnKey } : {};
        const r = await fetch(`https://api.greynoise.io/v3/community/${value}`, { headers });
        if (r.ok) {
          const d = await r.json();
          out.sources.greynoise = {
            classification: d.classification || null,
            name: d.name || null,
            last_seen: d.last_seen || null,
            noise: !!d.noise,
            riot: !!d.riot,
            link: `https://viz.greynoise.io/ip/${value}`,
          };
        } else { out.sources.greynoise = { error: `GreyNoise ${r.status}` }; }
      } catch (e) { out.sources.greynoise = { error: e.message }; }
    }

    const parts = [];
    if (out.sources.virustotal && out.sources.virustotal.malicious != null) {
      const total = out.sources.virustotal.malicious + out.sources.virustotal.suspicious + out.sources.virustotal.harmless + out.sources.virustotal.undetected;
      parts.push(`VirusTotal: ${out.sources.virustotal.malicious}/${total} malicious`);
    }
    if (out.sources.shodan?.org) parts.push(`Shodan: ${out.sources.shodan.org}`);
    if (out.sources.greynoise?.classification) parts.push(`GreyNoise: ${out.sources.greynoise.classification}`);
    out.summary = parts.join(' · ') || 'No enrichment data available (configure API keys for deeper intel).';
    out.keysConfigured = { virustotal: !!vtKey, shodan: !!shodanKey, greynoise: !!gnKey };

    return Response.json(out);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}