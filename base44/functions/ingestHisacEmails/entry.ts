import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';

const NVD_API_URL = 'https://services.nvd.nist.gov/rest/json/cves/2.0';
const EPSS_URL = 'https://api.first.org/data/v1/epss';

// Gmail API returns base64url-encoded body data; decode to readable text.
function decodeBase64Url(s) {
  return (s || '').replace(/-/g, '+').replace(/_/g, '/');
}

function extractTextFromPayload(payload) {
  if (!payload) return '';
  let text = '';
  if (payload.body && payload.body.data) {
    try { text += atob(decodeBase64Url(payload.body.data)); } catch (e) {}
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body && part.body.data) {
        try { text += atob(decodeBase64Url(part.body.data)); } catch (e) {}
      } else if (part.mimeType === 'text/html' && part.body && part.body.data && !text) {
        try { text += atob(decodeBase64Url(part.body.data)).replace(/<[^>]+>/g, ' '); } catch (e) {}
      } else if (part.parts) {
        text += extractTextFromPayload(part);
      }
    }
  }
  return text;
}

function getHeader(headers, name) {
  const h = (headers || []).find((x) => x.name && x.name.toLowerCase() === name.toLowerCase());
  return h ? h.value : '';
}

const SEVERITY_BASE_IMPACT = {
  Critical: { downtime: 24, cost: 50000 },
  High: { downtime: 8, cost: 20000 },
  Medium: { downtime: 2, cost: 5000 },
  Low: { downtime: 0.5, cost: 1000 },
};

function cvssToSeverity(score) {
  if (score == null) return null;
  if (score >= 9) return 'Critical';
  if (score >= 7) return 'High';
  if (score >= 4) return 'Medium';
  return 'Low';
}

// Enrich CVEs with authoritative CVSS + EPSS from NVD / FIRST.org.
async function enrichCvesFromNvd(cves) {
  const map = {};
  const unique = Array.from(new Set(cves.filter((c) => /^CVE-\d{4}-\d{4,7}$/i.test(c))));
  if (unique.length === 0) return map;
  const apiKey = secrets.get('NVD_API_KEY');
  const headers = apiKey ? { apiKey } : {};
  await Promise.all(unique.map(async (cve) => {
    try {
      const res = await fetch(`${NVD_API_URL}?cveId=${encodeURIComponent(cve)}`, { headers });
      if (!res.ok) return;
      const data = await res.json();
      const entry = data.vulnerabilities && data.vulnerabilities[0] && data.vulnerabilities[0].cve;
      if (!entry) return;
      const metrics = entry.metrics || {};
      const cvss = (metrics.cvssMetricV31 && metrics.cvssMetricV31[0])
        || (metrics.cvssMetricV30 && metrics.cvssMetricV30[0])
        || (metrics.cvssMetricV2 && metrics.cvssMetricV2[0]);
      if (cvss && cvss.cvssData && cvss.cvssData.baseScore != null) {
        map[cve] = { cvss_score: cvss.cvssData.baseScore };
      }
    } catch (_) { /* best-effort */ }
  }));
  // EPSS batch (up to 100 per call)
  try {
    const epssRes = await fetch(`${EPSS_URL}?cve=${unique.join(',')}`);
    if (epssRes.ok) {
      const epssData = await epssRes.json();
      for (const row of (epssData.data || [])) {
        if (map[row.cve]) {
          map[row.cve].epss_score = parseFloat(row.epss);
          map[row.cve].epss_percentile = parseFloat(row.percentile);
        }
      }
    }
  } catch (_) { /* best-effort */ }
  return map;
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin' && user.role !== 'superadmin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    let body = {};
    try { body = await req.json(); } catch (_) { body = {}; }
    const days = Math.min(Number(body.days) || 7, 30);
    const query = `subject:TLP OR subject:"Vulnerability Advisories" OR subject:"Threat Advisory" OR from:h-isac.org newer_than:${days}d`;

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');
    const authHeader = { Authorization: `Bearer ${accessToken}` };

    // Search for H-ISAC emails
    const searchRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=25`,
      { headers: authHeader }
    );
    if (!searchRes.ok) throw new Error(`Gmail search failed: ${searchRes.status}`);
    const searchData = await searchRes.json();
    const messageIds = (searchData.messages || []).map((m) => m.id);

    if (messageIds.length === 0) {
      return Response.json({ status: 'success', source: 'H-ISAC', emails_fetched: 0, created: 0, message: 'No H-ISAC emails found in the search window' });
    }

    // Fetch full content for each message
    const emails = [];
    await Promise.all(messageIds.map(async (id) => {
      try {
        const res = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
          { headers: authHeader }
        );
        if (!res.ok) return;
        const msg = await res.json();
        const subject = getHeader(msg.payload?.headers || [], 'Subject');
        const from = getHeader(msg.payload?.headers || [], 'From');
        const date = getHeader(msg.payload?.headers || [], 'Date');
        const bodyText = extractTextFromPayload(msg.payload).slice(0, 3000);
        emails.push({ id, subject, from, date, body: bodyText, url: `https://mail.google.com/mail?rm#${msg.threadId}` });
      } catch (e) { /* skip unreadable message */ }
    }));

    if (emails.length === 0) {
      return Response.json({ status: 'success', source: 'H-ISAC', emails_fetched: 0, created: 0, message: 'No readable H-ISAC emails' });
    }

    // Use LLM to parse unstructured email content into structured threat records
    const emailDigest = emails.map((e, i) =>
      `EMAIL ${i + 1}\nSubject: ${e.subject}\nFrom: ${e.from}\nDate: ${e.date}\nBody:\n${e.body}`
    ).join('\n\n---\n\n');

    const schema = {
      type: 'object',
      properties: {
        threats: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string', description: 'Concise threat headline' },
              description: { type: 'string', description: '1-3 sentence summary of the threat' },
              cve_id: { type: 'string', description: 'CVE ID if mentioned, empty string otherwise' },
              severity: { type: 'string', enum: ['Critical', 'High', 'Medium', 'Low'] },
              type: { type: 'string', enum: ['Vulnerability', 'Ransomware', 'Campaign', 'Malware', 'Breach', 'Advisory', 'Other'] },
              email_index: { type: 'number', description: 'The 1-based email index this threat was extracted from' },
            },
          },
        },
      },
    };

    const prompt = `You are a cybersecurity threat intelligence analyst. The following are emails received from H-ISAC (Health Information Sharing and Analysis Center). Extract each distinct threat, vulnerability, or security advisory mentioned across these emails into structured threat records. One email may contain multiple threats. Only extract genuine security threats, vulnerabilities, or advisories — ignore administrative emails, newsletters, event invitations, or marketing content. For each threat, provide a concise title, a summary description, any CVE ID mentioned, the severity (Critical/High/Medium/Low), and the threat type.\n\n${emailDigest}`;

    const llmResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: schema,
    });

    const parsedThreats = Array.isArray(llmResult?.threats) ? llmResult.threats : [];

    // Map parsed threats back to their source emails for source_url attribution
    const candidates = parsedThreats.map((t) => {
      const email = emails[(t.email_index || 1) - 1] || emails[0];
      return {
        title: (t.title || 'H-ISAC Threat').trim(),
        description: t.description || '',
        severity: t.severity || 'Medium',
        type: t.type || 'Advisory',
        cve_id: (t.cve_id || '').toUpperCase().trim(),
        cvss_score: null,
        source: 'H-ISAC',
        source_url: email ? email.url : '',
        status: 'New',
      };
    }).filter((c) => c.title && c.title !== 'H-ISAC Threat');

    // Dedup against existing threats — by cve_id when present, else by source_url + title
    const existing = await base44.asServiceRole.entities.Threat.list('-created_date', 500);
    const seenCves = new Set(existing.filter((t) => t.cve_id).map((t) => t.cve_id));
    const seenKeys = new Set(existing.map((t) => `${t.source_url || ''}::${t.title || ''}`.toLowerCase()));
    const localSeen = new Set();
    const fresh = candidates.filter((c) => {
      if (c.cve_id) {
        if (seenCves.has(c.cve_id) || localSeen.has(c.cve_id)) return false;
        localSeen.add(c.cve_id);
        return true;
      }
      const key = `${c.source_url}::${c.title}`.toLowerCase();
      if (!key || key === '::') return false;
      if (seenKeys.has(key) || localSeen.has(key)) return false;
      localSeen.add(key);
      return true;
    });

    // Enrich CVEs with authoritative CVSS + EPSS from NVD / FIRST.org
    const cveList = fresh.map((c) => c.cve_id).filter(Boolean);
    const nvdMap = await enrichCvesFromNvd(cveList);

    const toCreate = fresh.map((c) => {
      const nvd = c.cve_id ? nvdMap[c.cve_id] : null;
      if (nvd) {
        if (nvd.cvss_score != null) c.cvss_score = nvd.cvss_score;
        const sev = cvssToSeverity(nvd.cvss_score);
        if (sev) c.severity = sev;
        if (nvd.epss_score != null) c.epss_score = nvd.epss_score;
        if (nvd.epss_percentile != null) c.epss_percentile = nvd.epss_percentile;
      }
      const base = SEVERITY_BASE_IMPACT[c.severity] || SEVERITY_BASE_IMPACT.Medium;
      return {
        ...c,
        estimated_downtime_hours: base.downtime,
        estimated_recovery_cost: base.cost,
        retention_class: 'short',
      };
    });

    let created = 0;
    if (toCreate.length > 0) {
      const result = await base44.asServiceRole.entities.Threat.bulkCreate(toCreate);
      created = Array.isArray(result) ? result.length : toCreate.length;
    }

    return Response.json({
      status: 'success',
      source: 'H-ISAC',
      emails_fetched: emails.length,
      threats_parsed: parsedThreats.length,
      duplicates: candidates.length - fresh.length,
      created,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}