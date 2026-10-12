import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { matchThreatToProducts, computeRiskScore, estimateImpactFromMatch, tokenizeList } from "../../shared/threatScoring.ts";

const CISA_KEV_URL = 'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json';
const NVD_API_URL = 'https://services.nvd.nist.gov/rest/json/cves/2.0';

// Mirrors the SecureAscent/threatpulse collector source list (16 RSS feeds + BleepingComputer LLM + CISA KEV + NVD = 19 sources)
const RSS_FEEDS = [
  { name: 'CISA Alerts & Advisories', url: 'https://www.cisa.gov/news-events/cybersecurity-advisories/all.xml' },
  { name: 'Krebs on Security', url: 'https://krebsonsecurity.com/feed/' },
  { name: 'Dark Reading', url: 'https://www.darkreading.com/rss.xml' },
  { name: 'SANS ISC', url: 'https://isc.sans.edu/rssfeed_full.xml' },
  { name: 'Threatpost', url: 'https://threatpost.com/feed/' },
  { name: 'SecurityWeek', url: 'https://www.securityweek.com/feed/' },
  { name: 'Recorded Future', url: 'https://www.recordedfuture.com/feed' },
  { name: 'Unit 42', url: 'https://unit42.paloaltonetworks.com/feed/' },
  { name: 'Talos Intelligence', url: 'https://blog.talosintelligence.com/rss/' },
  { name: 'The Hacker News', url: 'https://feeds.feedburner.com/TheHackersNews' },
  { name: 'Schneier on Security', url: 'https://www.schneier.com/feed/' },
  { name: 'Malwarebytes Labs', url: 'https://blog.malwarebytes.com/feed/' },
  { name: 'Graham Cluley', url: 'https://grahamcluley.com/feed/' },
  { name: 'The Record', url: 'https://therecord.media/feed/' },
  { name: 'CyberScoop', url: 'https://www.cyberscoop.com/feed/' },
  { name: 'H-ISAC Vulnerability Bulletins', url: 'https://health-isac.org/tag/vulnerability-bulletin/feed/' },
  { name: 'Microsoft Security Blog', url: 'https://www.microsoft.com/en-us/security/blog/feed/' },
  { name: 'Google Project Zero', url: 'https://googleprojectzero.blogspot.com/feeds/posts/default' },
  { name: 'Securelist (Kaspersky)', url: 'https://securelist.com/feed/' },
  { name: 'Tenable Blog', url: 'https://www.tenable.com/blog/feed' },
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

async function fetchCisaKev(limit) {
  const res = await fetch(CISA_KEV_URL);
  if (!res.ok) throw new Error('CISA KEV fetch failed: ' + res.status);
  const data = await res.json();
  const vulns = (data.vulnerabilities || [])
    .slice(-limit)
    .reverse()
    .map((v) => ({
      title: v.vulnerabilityName || `${v.vendorProject || ''} ${v.product || ''}`.trim() || v.cveID,
      description: [v.requiredAction, v.notes].filter(Boolean).join(' ').trim() || v.vulnerabilityName || '',
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
  // Query by lastModified window so we capture both newly-published CVEs AND
  // older CVEs whose entries were recently updated (e.g. patch/severity changes).
  const url = `${NVD_API_URL}?lastModStartDate=${isoDaysAgo(days)}&lastModEndDate=${isoNow()}&resultsPerPage=${limit}`;
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
      published_date: cve.published || null,
      last_modified_date: cve.lastModified || null,
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

// Extract unique CPE 2.3 identifiers from an NVD CVE entry's configurations.
function extractCpes(entry) {
  const cpes = new Set();
  for (const cfg of (entry.configurations || [])) {
    for (const node of (cfg.nodes || [])) {
      for (const m of (node.cpeMatch || [])) {
        if (m.criteria) cpes.add(m.criteria);
      }
      for (const child of (node.children || [])) {
        for (const m of (child.cpeMatch || [])) {
          if (m.criteria) cpes.add(m.criteria);
        }
      }
    }
  }
  return Array.from(cpes);
}

// Look up full NVD metadata (CVSS score + version, published, lastModified, CPEs)
// for any candidate CVE missing any of those fields. Rate-limited, best-effort.
async function enrichFromNvd(apiKey, cves) {
  const map = {};
  const unique = Array.from(new Set(cves.filter((c) => /^CVE-\d{4}-\d+$/i.test(c))));
  if (unique.length === 0) return map;
  await Promise.all(unique.map(async (cve) => {
    try {
      const res = await fetch(`${NVD_API_URL}?cveId=${cve}`, { headers: apiKey ? { apiKey } : {} });
      if (!res.ok) return;
      const data = await res.json();
      const entry = data.vulnerabilities && data.vulnerabilities[0] && data.vulnerabilities[0].cve;
      if (!entry) return;
      const metrics = entry.metrics || {};
      const cvss31 = metrics.cvssMetricV31 && metrics.cvssMetricV31[0];
      const cvss30 = metrics.cvssMetricV30 && metrics.cvssMetricV30[0];
      const cvss2 = metrics.cvssMetricV2 && metrics.cvssMetricV2[0];
      const cvss = cvss31 || cvss30 || cvss2;
      const out = {};
      if (cvss && cvss.cvssData && cvss.cvssData.baseScore != null) {
        out.cvss_score = cvss.cvssData.baseScore;
        out.cvss_version = cvss31 ? '3.1' : cvss30 ? '3.0' : cvss2 ? '2.0' : null;
      }
      if (entry.published) out.published_date = entry.published;
      if (entry.lastModified) out.last_modified_date = entry.lastModified;
      const cpes = extractCpes(entry);
      if (cpes.length > 0) out.cpe = cpes.join("\n");
      map[cve] = out;
    } catch (e) { /* best-effort */ }
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
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
    },
  });
  if (!res.ok) throw new Error(`${feed.name} fetch failed: ${res.status}`);
  const xml = await res.text();
  const items = parseRss(xml).slice(0, limit);
  return items.map((it) => {
    const combined = `${it.title} ${it.description}`;
    return {
      title: (it.title || `${feed.name} update`).replace(/\s*-\s*BleepingComputer\s*$/i, '').trim(),
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

// BleepingComputer is behind Cloudflare which blocks datacenter IPs.
// Use LLM web search (Gemini) to fetch recent article metadata instead.
async function fetchBleepingComputerViaLLM(base44, limit) {
  const schema = {
    type: "object",
    properties: {
      articles: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            url: { type: "string" },
            date: { type: "string" },
          },
        },
      },
    },
  };
  const prompt = `List the ${limit} most recent news articles published on BleepingComputer.com. For each article provide the exact title, a concise 1-2 sentence summary, the full article URL (https://www.bleepingcomputer.com/...), and the publication date. Return only real current articles — do not fabricate content.`;
  const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt,
    add_context_from_internet: true,
    model: 'gemini_3_flash',
    response_json_schema: schema,
  });
  const articles = Array.isArray(result?.articles) ? result.articles : [];
  return articles.map((a) => {
    const combined = `${a.title || ''} ${a.description || ''}`;
    return {
      title: (a.title || 'Bleeping Computer update').replace(/\s*-\s*BleepingComputer\s*$/i, '').trim(),
      description: (a.description || '').slice(0, 500),
      severity: newsSeverity(combined),
      type: newsType(combined),
      cve_id: extractCve(combined),
      cvss_score: null,
      source: 'Bleeping Computer',
      source_url: a.url || 'https://www.bleepingcomputer.com/',
      status: 'New',
    };
  });
}

// SANS ISC feed can be blocked from datacenter IPs — use LLM web search as fallback.
async function fetchSansIscViaLLM(base44, limit) {
  const schema = {
    type: "object",
    properties: {
      diaries: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            url: { type: "string" },
            date: { type: "string" },
          },
        },
      },
    },
  };
  const prompt = `List the ${limit} most recent handler diary entries published on the SANS Internet Storm Center (isc.sans.edu). For each, provide the exact title, a concise 1-2 sentence summary, the full diary URL (https://isc.sans.edu/...), and the publication date. Return only real current entries — do not fabricate content.`;
  const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt,
    add_context_from_internet: true,
    model: 'gemini_3_flash',
    response_json_schema: schema,
  });
  const diaries = Array.isArray(result?.diaries) ? result.diaries : [];
  return diaries.map((d) => {
    const combined = `${d.title || ''} ${d.description || ''}`;
    return {
      title: (d.title || 'SANS ISC update').trim(),
      description: (d.description || '').slice(0, 500),
      severity: newsSeverity(combined),
      type: newsType(combined) || 'Advisory',
      cve_id: extractCve(combined),
      cvss_score: null,
      source: 'SANS ISC',
      source_url: d.url || 'https://isc.sans.edu/',
      status: 'New',
    };
  });
}

// CISA Alerts RSS can be blocked by Akamai from datacenter IPs.
// Use LLM web search as a fallback when the RSS feed fails.
async function fetchCisaAlertsViaLLM(base44, limit) {
  const schema = {
    type: "object",
    properties: {
      advisories: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            url: { type: "string" },
            date: { type: "string" },
          },
        },
      },
    },
  };
  const prompt = `List the ${limit} most recent cybersecurity advisories and alerts published on CISA.gov (Cybersecurity and Infrastructure Security Agency). For each, provide the exact title, a concise 1-2 sentence summary, the full advisory URL (https://www.cisa.gov/...), and the publication date. Return only real current advisories — do not fabricate content.`;
  const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt,
    add_context_from_internet: true,
    model: 'gemini_3_flash',
    response_json_schema: schema,
  });
  const advisories = Array.isArray(result?.advisories) ? result.advisories : [];
  return advisories.map((a) => {
    const combined = `${a.title || ''} ${a.description || ''}`;
    return {
      title: (a.title || 'CISA Advisory').trim(),
      description: (a.description || '').slice(0, 500),
      severity: newsSeverity(combined),
      type: newsType(combined) || 'Advisory',
      cve_id: extractCve(combined),
      cvss_score: null,
      source: 'CISA Alerts',
      source_url: a.url || 'https://www.cisa.gov/news-events/cybersecurity-advisories',
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
    const apiKey = Deno.env.get('NVD_API_KEY');
    if (source === 'nvd' || source === 'all') {
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

    // CISA Alerts RSS can be blocked by Akamai — fall back to LLM web search.
    if (source === 'rss' || source === 'all') {
      const cisaResult = feedResults.find((f) => f.name === 'CISA Alerts & Advisories');
      if (cisaResult && cisaResult.error) {
        try {
          const cisaItems = await fetchCisaAlertsViaLLM(base44, limit);
          candidates.push(...cisaItems);
          cisaResult.fetched = cisaItems.length;
          cisaResult.error = null;
          cisaResult.fallback = 'LLM web search';
        } catch (e) {
          cisaResult.error = `RSS failed; LLM fallback: ${e.message}`;
        }
      }
    }

    // SANS ISC feed can be blocked from datacenter IPs — fall back to LLM web search.
    if (source === 'rss' || source === 'all') {
      const sansResult = feedResults.find((f) => f.name === 'SANS ISC');
      if (sansResult && sansResult.error) {
        try {
          const sansItems = await fetchSansIscViaLLM(base44, limit);
          candidates.push(...sansItems);
          sansResult.fetched = sansItems.length;
          sansResult.error = null;
          sansResult.fallback = 'LLM web search';
        } catch (e) {
          sansResult.error = `RSS failed; LLM fallback: ${e.message}`;
        }
      }
    }

    // Bleeping Computer is behind Cloudflare — fetch via LLM web search (Gemini)
    if (source === 'rss' || source === 'all') {
      try {
        const bcItems = await fetchBleepingComputerViaLLM(base44, limit);
        candidates.push(...bcItems);
        feedResults.push({ name: 'Bleeping Computer', url: 'https://www.bleepingcomputer.com/', fetched: bcItems.length, error: null });
      } catch (e) {
        feedResults.push({ name: 'Bleeping Computer', url: 'https://www.bleepingcomputer.com/', fetched: 0, error: e.message });
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

    // NVD enrichment: fill in CVSS score + version, published_date, and
    // last_modified_date for any candidate CVE missing any of those fields
    // (e.g. CISA KEV entries and RSS items that carry only a CVE id).
    const needsEnrich = candidates
      .filter((c) => c.cve_id && (c.cvss_score == null || !c.cvss_version || !c.published_date || !c.last_modified_date || !c.cpe))
      .map((c) => c.cve_id);
    const nvdMap = await enrichFromNvd(apiKey, needsEnrich);
    candidates.forEach((c) => {
      if (c.cve_id && nvdMap[c.cve_id]) {
        const e = nvdMap[c.cve_id];
        if (c.cvss_score == null && e.cvss_score != null) c.cvss_score = e.cvss_score;
        if (!c.cvss_version && e.cvss_version) c.cvss_version = e.cvss_version;
        if (!c.published_date && e.published_date) c.published_date = e.published_date;
        if (!c.last_modified_date && e.last_modified_date) c.last_modified_date = e.last_modified_date;
        if (!c.cpe && e.cpe) c.cpe = e.cpe;
      }
    });

    // Dedup + merge against existing threats.
    // CVE duplicates are merged as alternate sources on the existing record
    // (one record per CVE, multi-source attribution) instead of being dropped.
    const existing = await base44.asServiceRole.entities.Threat.list('-created_date', 500);
    const existingByCve = {};
    existing.forEach((t) => { if (t.cve_id) existingByCve[t.cve_id] = t; });
    const seenKeys = new Set(existing.map((t) => (t.source_url || t.title || '').toLowerCase()));
    const localSeenCves = new Set();
    const localSeenKeys = new Set();
    const toCreate = [];
    const mergeUpdates = [];

    for (const c of candidates) {
      if (c.cve_id && existingByCve[c.cve_id]) {
        const ex = existingByCve[c.cve_id];
        const updates = { id: ex.id };
        const alternates = (ex.alternate_sources || '').split(/[,;|]/).map((s) => s.trim()).filter(Boolean);
        if (c.source && c.source !== ex.source && !alternates.includes(c.source)) {
          alternates.push(c.source);
          updates.alternate_sources = alternates.join(', ');
        }
        if (c.last_modified_date) {
          updates.last_modified_date = c.last_modified_date;
        }
        if (c.published_date && !ex.published_date) {
          updates.published_date = c.published_date;
        }
        if (Object.keys(updates).length > 1) {
          mergeUpdates.push(updates);
        }
        continue;
      }
      if (c.cve_id) {
        if (localSeenCves.has(c.cve_id)) continue;
        localSeenCves.add(c.cve_id);
      } else {
        const key = (c.source_url || c.title || '').toLowerCase();
        if (!key || seenKeys.has(key) || localSeenKeys.has(key)) continue;
        localSeenKeys.add(key);
      }
      toCreate.push(c);
    }

    // Load portfolio products once for ingest-time correlation + scoring.
    const productsPage = await base44.asServiceRole.entities.Product.filter({}, { limit: 500 });
    const products = (productsPage && productsPage.items) || [];

    const enriched = toCreate.map((c) => {
      const matched = matchThreatToProducts(c, products);
      let affected = c.affected_products || '';
      if (matched.length > 0) {
        const existingNames = new Set(tokenizeList(affected));
        matched.forEach((m) => {
          if (m.name && !existingNames.has(m.name.toLowerCase())) {
            affected = affected ? `${affected}, ${m.name}` : m.name;
            existingNames.add(m.name.toLowerCase());
          }
        });
      }
      const affectedCount = Math.max(1, tokenizeList(affected).length || 1);
      const matchedCount = Math.max(matched.length, affectedCount);
      const impact = estimateImpactFromMatch(c.severity, matchedCount);
      const risk_score = computeRiskScore({
        severity: c.severity,
        cvss_score: c.cvss_score,
        epss_score: c.epss_score,
        matchedProductCount: matchedCount,
        source: c.source,
      });
      return {
        ...c,
        affected_products: affected,
        ...impact,
        risk_score,
        retention_class: (c.source === 'NVD' || c.source === 'CISA KEV') ? 'standard' : 'short',
      };
    });

    // Final dedup pass: remove any records sharing the same source_url or title
    // (case-insensitive) that slipped through the per-candidate loop above.
    const finalSeen = new Set();
    const dedupedEnriched = enriched.filter((c) => {
      const key = (c.source_url || c.title || '').toLowerCase();
      if (!key || finalSeen.has(key)) return false;
      finalSeen.add(key);
      return true;
    });

    let created = 0;
    if (dedupedEnriched.length > 0) {
      // Chunk into batches of 50 to avoid server-side duplicate-ID rejection on large batches.
      const CHUNK = 50;
      for (let i = 0; i < dedupedEnriched.length; i += CHUNK) {
        const batch = dedupedEnriched.slice(i, i + CHUNK);
        try {
          const result = await base44.asServiceRole.entities.Threat.bulkCreate(batch);
          created += Array.isArray(result) ? result.length : batch.length;
        } catch (e) {
          // If a batch fails, try records one at a time so one bad record doesn't abort the run.
          for (const rec of batch) {
            try {
              await base44.asServiceRole.entities.Threat.create(rec);
              created++;
            } catch (_) { /* skip individual failures */ }
          }
        }
      }
    }
    // Deduplicate merge updates by record id — multiple candidates can reference
    // the same existing CVE, and bulkUpdate rejects duplicate entity IDs.
    const mergeById = {};
    for (const mu of mergeUpdates) {
      if (!mergeById[mu.id]) {
        mergeById[mu.id] = { id: mu.id, _alternates: new Set(), last_modified_date: null, published_date: null };
      }
      if (mu.alternate_sources) {
        (mergeById[mu.id]._alternates).add(mu.alternate_sources);
      }
      if (mu.last_modified_date) mergeById[mu.id].last_modified_date = mu.last_modified_date;
      if (mu.published_date) mergeById[mu.id].published_date = mu.published_date;
    }
    const dedupedMerges = Object.values(mergeById).map((m) => {
      const out = { id: m.id };
      if (m._alternates.size > 0) out.alternate_sources = Array.from(m._alternates).join(', ');
      if (m.last_modified_date) out.last_modified_date = m.last_modified_date;
      if (m.published_date) out.published_date = m.published_date;
      return out;
    });

    let merged = 0;
    if (dedupedMerges.length > 0) {
      await base44.asServiceRole.entities.Threat.bulkUpdate(dedupedMerges);
      merged = dedupedMerges.length;
    }

    // Backfill: existing threat records with a CVE but missing NVD metadata
    // (cvss_score, cvss_version, published_date, last_modified_date). Capped
    // per run to respect NVD rate limits; subsequent runs pick up the rest.
    let backfilled = 0;
    try {
      const existingWithCve = existing.filter(
        (t) => t.cve_id && (!t.cvss_score || !t.cvss_version || !t.published_date || !t.last_modified_date || !t.cpe)
      );
      const toBackfill = existingWithCve.slice(0, 50);
      if (toBackfill.length > 0) {
        const backfillMap = await enrichFromNvd(apiKey, toBackfill.map((t) => t.cve_id));
        const updates = [];
        for (const t of toBackfill) {
          const e = backfillMap[t.cve_id];
          if (!e) continue;
          const u = { id: t.id };
          if (t.cvss_score == null && e.cvss_score != null) u.cvss_score = e.cvss_score;
          if (!t.cvss_version && e.cvss_version) u.cvss_version = e.cvss_version;
          if (!t.published_date && e.published_date) u.published_date = e.published_date;
          if (!t.last_modified_date && e.last_modified_date) u.last_modified_date = e.last_modified_date;
          if (!t.cpe && e.cpe) u.cpe = e.cpe;
          if (Object.keys(u).length > 1) updates.push(u);
        }
        if (updates.length > 0) {
          await base44.asServiceRole.entities.Threat.bulkUpdate(updates);
          backfilled = updates.length;
        }
      }
    } catch (e) { /* best-effort backfill */ }

    return Response.json({
      status: 'success',
      source,
      fetched: candidates.length,
      duplicates: candidates.length - toCreate.length - merged,
      merged,
      created,
      backfilled,
      feeds: feedResults,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});