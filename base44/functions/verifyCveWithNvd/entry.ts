import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';

const NVD_API_URL = 'https://services.nvd.nist.gov/rest/json/cves/2.0';
const EPSS_URL = 'https://api.first.org/data/v1/epss';

function cvssToSeverity(score) {
  if (score == null) return 'Medium';
  if (score >= 9) return 'Critical';
  if (score >= 7) return 'High';
  if (score >= 4) return 'Medium';
  return 'Low';
}

function extractCpes(entry) {
  const cpes = new Set();
  const configs = entry.configurations || [];
  for (const node of configs) {
    for (const n of node.nodes || []) {
      for (const m of (n.cpeMatch || [])) {
        if (m.criteria) cpes.add(m.criteria);
      }
    }
  }
  return Array.from(cpes);
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const cveId = (body.cve_id || '').trim().toUpperCase();
    if (!/^CVE-\d{4}-\d{4,7}$/i.test(cveId)) {
      return Response.json({ error: 'Valid CVE ID required (e.g. CVE-2024-1234)' }, { status: 400 });
    }

    const apiKey = secrets.get("NVD_API_KEY");
    const headers = apiKey ? { apiKey } : {};
    const res = await fetch(`${NVD_API_URL}?cveId=${encodeURIComponent(cveId)}`, { headers });
    if (!res.ok) {
      return Response.json({ verified: false, error: `NVD API returned ${res.status}` }, { status: 502 });
    }
    const data = await res.json();
    const entry = data.vulnerabilities && data.vulnerabilities[0] && data.vulnerabilities[0].cve;
    if (!entry || entry.id !== cveId) {
      return Response.json({ verified: false, cve_id: cveId, error: 'CVE not found in NVD' });
    }

    const metrics = entry.metrics || {};
    const cvss = (metrics.cvssMetricV31 && metrics.cvssMetricV31[0])
      || (metrics.cvssMetricV30 && metrics.cvssMetricV30[0])
      || (metrics.cvssMetricV2 && metrics.cvssMetricV2[0]);
    const cvssData = cvss && cvss.cvssData;
    const cvssScore = cvssData ? cvssData.baseScore : null;
    const descriptions = (entry.descriptions || []).filter((d) => d.lang === 'en');
    const description = descriptions.length ? descriptions[0].value : '';
    const cpes = extractCpes(entry);

    // Fetch EPSS score
    let epssScore = null;
    let epssPercentile = null;
    try {
      const epssRes = await fetch(`${EPSS_URL}?cve=${encodeURIComponent(cveId)}`);
      if (epssRes.ok) {
        const epssData = await epssRes.json();
        const row = epssData.data && epssData.data[0];
        if (row) {
          epssScore = parseFloat(row.epss);
          epssPercentile = parseFloat(row.percentile);
        }
      }
    } catch (_) { /* best-effort */ }

    return Response.json({
      verified: true,
      cve_id: cveId,
      cvss_score: cvssScore,
      severity: cvssToSeverity(cvssScore),
      description,
      affected_products: cpes.join(', ') || null,
      published: entry.published || null,
      last_modified: entry.lastModified || null,
      source: 'NVD',
      source_url: `https://nvd.nist.gov/vuln/detail/${cveId}`,
      epss_score: epssScore,
      epss_percentile: epssPercentile,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}