// Shared Cybellum sync logic — used by both the user-triggered syncCybellum
// function and the scheduled syncAllCybellumConnections function.
// Extracted here so both callers share identical field mapping and upsert logic.

export const CYBELLUM_ENDPOINTS = {
  products: ['/api/v1/assets', '/api/v1/products', '/api/v2/assets'],
  components: ['/api/v1/sbom', '/api/v1/components', '/api/v2/sbom'],
  findings: ['/api/v1/vulnerabilities', '/api/v1/findings', '/api/v2/vulnerabilities'],
};

const MAX_PAGES = 20;
const PAGE_SIZE = 100;

function pick(obj: any, names: string[], fallback: any = undefined): any {
  if (!obj) return fallback;
  for (const n of names) {
    if (obj[n] !== undefined && obj[n] !== null && obj[n] !== '') return obj[n];
  }
  return fallback;
}

function firstStr(v: any): string {
  if (Array.isArray(v)) return v.map((x) => (typeof x === 'object' ? JSON.stringify(x) : String(x))).join(', ');
  return v === undefined || v === null ? '' : String(v);
}

function extractList(data: any): any[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  const keys = ['items', 'results', 'data', 'assets', 'products', 'components', 'vulnerabilities', 'findings'];
  for (const k of keys) {
    if (Array.isArray(data[k])) return data[k];
  }
  return [];
}

function buildHeaders(apiToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiToken}`,
    Accept: 'application/json',
    'User-Agent': 'ThreatPulse/1.0 (security-monitoring)',
  };
}

// Paginated GET helper. Returns up to MAX_PAGES * PAGE_SIZE items per resource kind.
async function fetchAll(baseUrl: string, headers: Record<string, string>, paths: string[], label: string): Promise<any[]> {
  for (const path of paths) {
    const items: any[] = [];
    let url = `${baseUrl}${path}?limit=${PAGE_SIZE}`;
    let pages = 0;
    let pathWorked = false;
    while (url && pages < MAX_PAGES) {
      let res: Response;
      try {
        res = await fetch(url, { method: 'GET', headers });
      } catch {
        break; // network error — try next path
      }
      pathWorked = true;
      if (res.status === 404) break; // try next path
      if (res.status === 401 || res.status === 403) {
        throw new Error(`Cybellum auth failed (${res.status}) — check the API token on the connection.`);
      }
      if (!res.ok) {
        throw new Error(`Cybellum ${label} returned ${res.status} on ${path}`);
      }
      const text = await res.text();
      let data: any = null;
      try { data = text ? JSON.parse(text) : null; } catch { data = null; }
      const batch = extractList(data);
      items.push(...batch);
      const next = pick(data, ['next', 'next_url', 'nextUrl', 'cursor', 'next_cursor', 'nextCursor'], null);
      if (next && typeof next === 'string' && next.startsWith('http')) {
        url = next;
      } else if (next && typeof next === 'string') {
        url = `${baseUrl}${path}?limit=${PAGE_SIZE}&cursor=${encodeURIComponent(next)}`;
      } else {
        url = '';
      }
      pages++;
      if (batch.length < PAGE_SIZE) break; // last page
    }
    if (pathWorked) return items;
  }
  return [];
}

export interface SyncResult {
  products: number;
  sbom_components: number;
  vulnerability_findings: number;
  summary: string;
  error?: string;
}

// Syncs a single Cybellum connection into ThreatPulse entities.
// `base44` should be a service-role client (base44.asServiceRole) so this works
// in both user-triggered and scheduled contexts.
export async function syncConnection(base44: any, conn: any, org: any): Promise<SyncResult> {
  const baseUrl = (conn.base_url || '').replace(/\/$/, '');
  const apiToken = conn.api_token;
  const headers = buildHeaders(apiToken);

  // 1. Products / assets
  const assets = await fetchAll(baseUrl, headers, CYBELLUM_ENDPOINTS.products, 'products');
  const productRecords = assets.map((a: any) => ({
    name: firstStr(pick(a, ['name', 'productName', 'assetName', 'title'], 'Unnamed Cybellum asset')),
    vendor: firstStr(pick(a, ['vendor', 'manufacturer', 'supplier', 'vendorName'], '')),
    current_version: firstStr(pick(a, ['version', 'currentVersion', 'productVersion', 'firmwareVersion'], '')),
    status: 'Active',
    cpe_vendor: firstStr(pick(a, ['cpeVendor', 'cpe_vendor'], '')) || undefined,
    cpe_product: firstStr(pick(a, ['cpeProduct', 'cpe_product'], '')) || undefined,
    keywords: firstStr(pick(a, ['keywords', 'tags', 'categories'], '')) || undefined,
    sbom_enrolled: true,
    organization_id: org.id,
    notes: 'Synced from Cybellum',
  })).filter((p: any) => p.name && p.name !== 'Unnamed Cybellum asset');

  let productsUpserted = 0;
  if (productRecords.length) {
    const up = await base44.entities.Product.upsert(productRecords, { key: ['name', 'organization_id'] });
    productsUpserted = (up?.records || []).length;
  }

  // Build name->id map for SBOM linking
  const productMap = new Map<string, string>();
  if (productRecords.length) {
    const owned = await base44.entities.Product.filter(
      { organization_id: org.id },
      { limit: 500, fields: ['id', 'name'] }
    );
    for (const p of owned?.items || []) productMap.set(p.name, p.id);
  }

  // 2. SBOM components
  const components = await fetchAll(baseUrl, headers, CYBELLUM_ENDPOINTS.components, 'sbom');
  const sbomRecords = components.map((c: any) => {
    const pName = firstStr(pick(c, ['productName', 'product_name', 'assetName', 'asset_name', 'parentProduct'], ''));
    return {
      component_name: firstStr(pick(c, ['name', 'componentName', 'component_name', 'packageName', 'package_name'], 'Unknown component')),
      component_version: firstStr(pick(c, ['version', 'componentVersion', 'component_version'], '')),
      vendor: firstStr(pick(c, ['vendor', 'supplier', 'supplierName'], '')),
      purl: firstStr(pick(c, ['purl', 'packageUrl', 'package_url'], '')) || undefined,
      cpe: firstStr(pick(c, ['cpe', 'cpe23', 'cpeString'], '')) || undefined,
      license: firstStr(pick(c, ['license', 'licenseName', 'licenses'], '')) || undefined,
      dependency_type: 'direct',
      product_id: pName ? (productMap.get(pName) || undefined) : undefined,
      product_name: pName || undefined,
      organization_id: org.id,
      source: 'cybellum',
      status: 'active',
    };
  }).filter((s: any) => s.component_name && s.component_name !== 'Unknown component');

  let sbomUpserted = 0;
  if (sbomRecords.length) {
    const up = await base44.entities.SbomRecord.upsert(sbomRecords, { key: ['component_name', 'component_version', 'organization_id'] });
    sbomUpserted = (up?.records || []).length;
  }

  // 3. Vulnerability findings (CVE only)
  const findings = await fetchAll(baseUrl, headers, CYBELLUM_ENDPOINTS.findings, 'vulnerabilities');
  const threatRecords = findings.map((f: any) => {
    const cve = firstStr(pick(f, ['cve', 'cveId', 'cve_id', 'cveName'], ''));
    if (!cve) return null;
    const cvss = pick(f, ['cvss', 'cvssScore', 'cvss_score', 'cvssV3Score'], null);
    const sevRaw = String(pick(f, ['severity', 'riskLevel', 'risk_level', 'priority'], 'Medium')).toLowerCase();
    const severity = sevRaw === 'critical' ? 'Critical'
      : sevRaw === 'high' ? 'High'
      : sevRaw === 'low' ? 'Low'
      : 'Medium';
    const affected = firstStr(pick(f, ['affectedProducts', 'affected_products', 'products', 'assets'], ''));
    return {
      title: firstStr(pick(f, ['title', 'name', 'summary', 'description'], cve)),
      description: firstStr(pick(f, ['description', 'summary', 'details'], '')),
      severity,
      type: 'Vulnerability',
      cve_id: cve,
      cvss_score: typeof cvss === 'number' ? cvss : undefined,
      source: 'Cybellum',
      source_url: firstStr(pick(f, ['url', 'link', 'referenceUrl'], '')) || undefined,
      affected_products: affected || undefined,
      status: 'New',
      in_vrm: true,
    };
  }).filter(Boolean);

  let threatsUpserted = 0;
  if (threatRecords.length) {
    const up = await base44.entities.Threat.upsert(threatRecords, { key: ['cve_id', 'source'] });
    threatsUpserted = (up?.records || []).length;
  }

  const summary = `Synced ${productsUpserted} products, ${sbomUpserted} SBOM components, ${threatsUpserted} vulnerability findings from Cybellum.`;

  return {
    products: productsUpserted,
    sbom_components: sbomUpserted,
    vulnerability_findings: threatsUpserted,
    summary,
  };
}