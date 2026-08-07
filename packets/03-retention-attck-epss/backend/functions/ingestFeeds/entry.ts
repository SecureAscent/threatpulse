import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const CISA_KEV_URL = 'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json';
const NVD_API_URL = 'https://services.nvd.nist.gov/rest/json/cves/2.0';

// Mirrors the SecureAscent/threatpulse collector source list (18 RSS feeds + CISA KEV + NVD = 20 sources)
const RSS_FEEDS = [
  { name: 'US-CERT/CISA', url: 'https://www.cisa.gov/news-events/cybersecurity-advisories/all.xml' },
  { name: 'CISA Alerts', url: 'https://www.cisa.gov/news-events/alerts/all.xml' },
  { name: 'Krebs on Security', url: 'https://krebsonsecurity.com/feed/' },
  { name: 'Bleeping Computer', url: 'https://www.bleepingcomputer.com/feed/' },
  { name: 'Dark Reading', url: 'https://www.darkreading.com/rss.xml' },
  { name: 'SANS ISC', url: 'https://isc.sans.edu/rss.xml' },
  { name: 'Threatpost', url: 'https://threatpost.com/feed/' },
  { name: 'SecurityWeek', url: 'https://www.securityweek.com/feed/' },
  { name: 'Recorded Future', url: 'https://www.recordedfuture.com/feed' },
  { name: 'Unit 42', url: 'https://unit42.paloaltonetworks.com/feed/' },
  { name: 'Talos Intelligence', url: 'https://blog.talosintelligence.com/rss/' },
  { name: 'The Hacker News', url: 'https://feeds.feedburner.com/TheHackersNews' },
  { name: 'Schneier on Security', url: 'https://www.schneier.com/feed/' },
  { name: 'Naked Security', url: 'https://nakedsecurity.sophos.com/feed/' },
  { name: 'Malwarebytes Labs', url: 'https://blog.malwarebytes.com/feed/' },
  { name: 'Graham Cluley', url: 'https://grahamcluley.com/feed/' },
  { name: 'The Record', url: 'https://therecord.media/feed/' },
  { name: 'CyberScoop', url: 'https://www.cyberscoop.com/feed/' },
];

function isoDaysAgo(days) {
  const d = new Date(Date.now() - days * 86400000);
  return d.toISOString().replace(/\.\d{3}Z$/, '.000Z');
}
function isoNow() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, '.999Z');
}

function nvdSeverityToThreat(sev) {
  if (!sev) return 'Medium';
  const s = sev.toLowerCase();
  if (s === 'critical') return 'Critical';
  if (s === 'high') return 'High';
  if (s === 'medium') return 'Medium';
  if (s === 'low') return 'Low';
  return 'Medium';
}

const SEVERITY_BASE_IMPACT = {
  Critical: { downtime: 24, cost: 50000 },
  High: { downtime: 8, cost: 20000 },
  Medium: { downtime: 2, cost: 5000 },
  Low: { downtime: 0.5, cost: 1000 },
};
function estimateImpact(c) {
  const base = SEVERITY_BASE_IMPACT[c.severity] || SEVERITY_BASE_IMPACT.Medium;
  const products = (c.affected_products || '').split(/[,;|]/).map((s) => s.trim()).filter(Boolean);
  const productCount = Math.max(1, products.length);
  return {
    estimated_downtime_hours: Math.round(base.downtime * productCount * 10) / 10,
    estimated_recovery_cost: Math.round(base.cost * productCount),
  };
}

async function fetchCisaKev(limit) {
  const res = await fetch(CISA_KEV_URL);
  if (!res.ok) throw new Error('CISA KEV fetch failed: ' + res.status);
  const data = await res.json();
  const vulns = (data.vulnerabilities || [])
    .slice(-limit)
    .reverse()
    .map((v) => ({
      title: v.vulnerabilityName || `${v.vendorProject || ''} ${v.product || ''}`.trim() || v.cveID,
      description: v.shortDescription || '',
      severity: v.knownRansomwareCampaignUse === 'Known' ? 'Critical' : 'High',
      type: 'Vulnerability',
      cve_id: v.cveID || '',
      cvss_score: null,
      source: 'CISA KEV',
      source_url: v.cveID ? `https://nvd.nist.gov/vuln/detail/${v.cveID}` : 'https://www.cisa.gov/known-exploited-vulnerabilities-catalog',
      affected_products: [v.vendorProject, v.product].filter(Boolean).join(' ').trim(),
      status: 'New',
    }));
  return vulns;
}

async function fetchNvd(apiKey, days, limit) {
  const url = `${NVD_API_URL}?pubStartDate=${isoDaysAgo(days)}&pubEndDate=${isoNow()}&resultsPerPage=${limit}`;
  const headers = apiKey ? { apiKey } : {};
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error('NVD fetch failed: ' + res.status);
  const data = await res.json();
  const vulns = (data.vulnerabilities || []).map((entry) => {
    const cve = entry.cve || {};
    const desc = (cve.descriptions || []).find((d) => d.lang === 'en');
    const metrics = cve.metrics || {};
    const cvss = (metrics.cvssMetricV31 && metrics.cvssMetricV31[0]) || (metrics.cvssMetricV30 && metrics.cvssMetricV30[0]) || (metrics.cvssMetricV2 && metrics.cvssMetricV2[0]);
    const baseScore = cvss ? cvss.cvssData.baseScore : null;
    const baseSeverity = cvss ? (cvss.baseSeverity || (cvss.cvssData && cvss.cvssData.baseSeverity)) : null;
    const refs = (cve.references || []).map((r) => r.url).filter(Boolean);
    return {
      title: (desc && desc.value ? desc.value.split('.')[0].slice(0, 120) : cve.id),
      description: desc ? desc.value : '',
      severity: nvdSeverityToThreat(baseSeverity || (baseScore ? (baseScore >= 9 ? 'Critical' : baseScore >= 7 ? 'High' : baseScore >= 4 ? 'Medium' : 'Low') : null)),
      type: 'Vulnerability',
      cve_id: cve.id || '',
      cvss_score: baseScore,
      source: 'NVD',
      source_url: cve.id ? `https://nvd.nist.gov/vuln/detail/${cve.id}` : (refs[0] || 'https://nvd.nist.gov'),
      status: 'New',
    };
  });
  return vulns;
}

function decodeXml(s) {
  return (s || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

function stripHtml(s) {
  return decodeXml(s)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseRss(xml) {
  const items = [];
  if (/<feed[\s>]/i.test(xml)) {
    const re = /<entry[\s>][\s\S]*?<\/entry>/gi;
    let m;
    while ((m = re.exec(xml))) {
      const block = m[0];
      const title = (block.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || ['', ''])[1];
      let link = (block.match(/<link[^>]*href="([^"]+)"/i) || ['', ''])[1];
      if (!link) link = (block.match(/<link[^>]*>([\s\S]*?)<\/link>/i) || ['', ''])[1];
      const desc = (block.match(/<(summary|content)[^>]*>([\s\S]*?)<\/\1>/i) || ['', '', ''])[2];
      const date = (block.match(/<(updated|published)[^>]*>([\s\S]*?)<\/\1>/i) || ['', '', ''])[2];
      items.push({ title: stripHtml(title), link: decodeXml(link).trim(), description: stripHtml(desc), date: decodeXml(date).trim() });
    }
    return items;
  }
  const re = /<item[\s>][\s\S]*?<\/item>/gi;
  let m;
  while ((m = re.exec(xml))) {
    const block = m[0];
    const title = (block.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || ['', ''])[1];
    const link = (block.match(/<link[^>]*>([\s\S]*?)<\/link>/i) || ['', ''])[1];
    const desc = (block.match(/<description[^>]*>([\s\S]*?)<\/description>/i) || ['', ''])[1];
    const date = (block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i) || ['', ''])[1];
    items.push({ title: stripHtml(title), link: decodeXml(link).trim(), description: stripHtml(desc), date: decodeXml(date).trim() });
  }
  return items;
}

function extractCve(text) {
  const m = (text || '').match(/CVE-\d{4}-\d{4,7}/i);
  return m ? m[0].toUpperCase() : '';
}

function newsType(text) {
  const s = (text || '').toLowerCase();
  if (/ransomware/.test(s)) return 'Ransomware';
  if (/breach|data leak|leaked/.test(s)) return 'Breach';
  if (/malware|trojan|botnet|backdoor|worm|infostealer/.test(s)) return 'Malware';
  if (/campaign|apt|threat group|threat actor/.test(s)) return 'Campaign';
  if (/cve-|vulnerab|patch|flaw|zero-day|0day|exploit/.test(s)) return 'Vulnerability';
  return 'Advisory';
}

async function fetchEpssBatch(cves) {
  const map = {};
  const unique = Array.from(new Set(cves.filter((c) => /^CVE-\d{4}-\d+$/i.test(c))));
  if (unique.length === 0) return map;
  const batches = [];
  unique.forEach((c, idx) => {
    const bi = Math.floor(idx / 100);
    if (!batches[bi]) batches[bi] = [];
    batches[bi].push(c);
  });
  await Promise.all(batches.map(async (batch) => {
    try {
      const url = `https://api.first.org/data/v1/epss?cve=${batch.join(",")}`;
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) return;
      const data = await res.json();
      (data.data || []).forEach((e) => {
        const score = parseFloat(e.epss);
        const pct = parseFloat(e.percentile);
        if (!isNaN(score)) map[e.cve] = { score, percentile: isNaN(pct) ? 0 : pct };
      });
    } catch { /* best-effort */ }
  }));
  return map;
}

function newsSeverity(text) {
  const s = (text || '').toLowerCase();
  if (/critical|zero-day|0day|zero day|actively exploited|ransomware/.test(s)) return 'Critical';
  if (/breach|exploit|attack|malware|backdoor|botnet|data leak/.test(s)) return 'High';
  if (/patch|update|advisory|warn|flaw|bug|vulnerab/.test(s)) return 'Medium';
  return 'Low';
}

async function fetchRssFeed(feed, limit) {
  const res = await fetch(feed.url, {
    redirect: 'follow',
    headers: {
      'User-Agent': 'ThreatPulseBot/1.0 (+https://threatpulseintel.com)',
      'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
    },
  });
  if (!res.ok) throw new Error(`${feed.name} fetch failed: ${res.status}`);
  const xml = await res.text();
  const items = parseRss(xml).slice(0, limit);
  return items.map((it) => {
    const combined = `${it.title} ${it.description}`;
    return {
      title: it.title || `${feed.name} update`,
      description: it.description.slice(0, 500),
      severity: newsSeverity(combined),
      type: newsType(combined),
      cve_id: extractCve(combined),
      cvss_score: null,
      source: feed.name,
      source_url: it.link || feed.url,
      status: 'New',
    };
  });
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let body = {};
    try { body = await req.json(); } catch (_) { body = {}; }
    const source = body.source || 'all';
    const limit = Math.min(Number(body.limit) || 25, 100);
    const nvdDays = Math.min(Number(body.days) || 7, 30);

    const candidates = [];
    const feedResults = [];
    if (source === 'cisa' || source === 'all') {
      candidates.push(...await fetchCisaKev(limit));
    }
    if (source === 'nvd' || source === 'all') {
      const apiKey = Deno.env.get('NVD_API_KEY');
      candidates.push(...await fetchNvd(apiKey, nvdDays, limit));
    }
    if (source === 'rss' || source === 'all') {
      for (const feed of RSS_FEEDS) {
        try {
          const items = await fetchRssFeed(feed, limit);
          candidates.push(...items);
          feedResults.push({ name: feed.name, url: feed.url, fetched: items.length, error: null });
        } catch (e) {
          feedResults.push({ name: feed.name, url: feed.url, fetched: 0, error: e.message });
        }
      }
    }

    // EPSS enrichment for CVEs (FIRST.org exploit prediction scoring)
    const cveList = candidates.map((c) => c.cve_id).filter(Boolean);
    const epssMap = await fetchEpssBatch(cveList);
    candidates.forEach((c) => {
      if (c.cve_id && epssMap[c.cve_id]) {
        c.epss_score = epssMap[c.cve_id].score;
        c.epss_percentile = epssMap[c.cve_id].percentile;
      }
    });

    // Dedup against existing threats — by cve_id when present, else by source_url/title
    const existing = await base44.asServiceRole.entities.Threat.list('-created_date', 500);
    const seenCves = new Set(existing.filter((t) => t.cve_id).map((t) => t.cve_id));
    const seenKeys = new Set(existing.map((t) => (t.source_url || t.title || '').toLowerCase()));
    const localSeen = new Set();
    const fresh = candidates.filter((c) => {
      if (c.cve_id) {
        if (seenCves.has(c.cve_id) || localSeen.has(c.cve_id)) return false;
        localSeen.add(c.cve_id);
        return true;
      }
      const key = (c.source_url || c.title || '').toLowerCase();
      if (!key) return false;
      if (seenKeys.has(key) || localSeen.has(key)) return false;
      localSeen.add(key);
      return true;
    });

    let created = 0;
    if (fresh.length > 0) {
      const toCreate = fresh.map((c) => ({
        ...c,
        ...estimateImpact(c),
        retention_class: (c.source === 'NVD' || c.source === 'CISA KEV') ? 'standard' : 'short',
      }));
      const result = await base44.asServiceRole.entities.Threat.bulkCreate(toCreate);
      created = Array.isArray(result) ? result.length : fresh.length;
    }

    return Response.json({
      status: 'success',
      source,
      fetched: candidates.length,
      duplicates: candidates.length - fresh.length,
      created,
      feeds: feedResults,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});