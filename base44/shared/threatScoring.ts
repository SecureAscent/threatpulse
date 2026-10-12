// ThreatPulse shared scoring + product-correlation logic.
// Imported by ingestFeeds (and other backend functions) so the ingest pipeline,
// SLA alerts, and reports all share one risk model.

// Source reliability tiers (0-1) grounded in Admiralty-style confidence.
// Authoritative vulnerability catalogs score highest; vendor blogs next;
// general security news lower.
const SOURCE_RELIABILITY = {
  'CISA KEV': 1.0,
  'CISA Alerts': 0.95,
  'NVD': 1.0,
  'H-ISAC Vulnerability Bulletins': 0.85,
  'Microsoft Security Blog': 0.85,
  'Google Project Zero': 0.85,
  'Securelist (Kaspersky)': 0.8,
  'Tenable Blog': 0.8,
  'Unit 42': 0.8,
  'Talos Intelligence': 0.8,
  'Recorded Future': 0.8,
  'SANS ISC': 0.75,
  'Krebs on Security': 0.75,
  'Schneier on Security': 0.75,
  'Dark Reading': 0.65,
  'SecurityWeek': 0.65,
  'The Hacker News': 0.65,
  'The Record': 0.65,
  'CyberScoop': 0.65,
  'Bleeping Computer': 0.6,
  'Threatpost': 0.6,
  'Malwarebytes Labs': 0.6,
  'Graham Cluley': 0.6,
};

export function sourceReliability(source) {
  if (!source) return 0.6;
  return SOURCE_RELIABILITY[source] != null ? SOURCE_RELIABILITY[source] : 0.6;
}

export function tokenizeList(str) {
  if (!str) return [];
  return String(str)
    .split(/[,;|\n]/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

// Match a threat candidate to portfolio products using CPE, name, vendor,
// keyword, and affiliated-software signals. Returns matched product records.
export function matchThreatToProducts(threat, products) {
  if (!products || !products.length) return [];
  const threatText = (
    `${threat.affected_products || ''} ${threat.title || ''} ${threat.description || ''}`
  ).toLowerCase();
  const threatProducts = tokenizeList(threat.affected_products);
  const matches = [];

  for (const product of products) {
    if (product.status === 'Retired') continue;
    let matched = false;

    // 1. CPE vendor + product
    const cpeVendor = (product.cpe_vendor || '').toLowerCase();
    const cpeProduct = (product.cpe_product || '').toLowerCase();
    if (cpeVendor && cpeProduct && threatText.includes(cpeVendor) && threatText.includes(cpeProduct)) {
      matched = true;
    }

    // 2. Product name (exact or substring on affected_products)
    if (!matched) {
      const productName = (product.name || '').toLowerCase();
      if (productName && threatProducts.some((tp) => tp.includes(productName) || productName.includes(tp))) {
        matched = true;
      }
    }

    // 3. Vendor name
    if (!matched) {
      const vendor = (product.vendor || '').toLowerCase();
      if (vendor && vendor.length > 2 && threatText.includes(vendor)) {
        matched = true;
      }
    }

    // 4. Keywords
    if (!matched) {
      for (const kw of tokenizeList(product.keywords)) {
        if (kw.length > 2 && threatText.includes(kw)) { matched = true; break; }
      }
    }

    // 5. Affiliated software
    if (!matched) {
      for (const aff of tokenizeList(product.affiliated_software)) {
        if (aff.length > 2 && threatText.includes(aff)) { matched = true; break; }
      }
    }

    if (matched) matches.push(product);
  }
  return matches;
}

// Composite ThreatPulse Risk Score (0-100):
// 35% CVSS impact + 30% EPSS likelihood + 25% portfolio blast radius + 10% source reliability
export function computeRiskScore({ severity, cvss_score, epss_score, matchedProductCount, source }) {
  const cvss = cvss_score != null ? Math.min(cvss_score / 10, 1) : 0.5;
  const epss = epss_score != null ? Math.min(epss_score, 1) : 0.1;
  const blast = Math.min((matchedProductCount || 0) / 5, 1); // 5+ matched products = max
  const rel = sourceReliability(source);
  const score = (cvss * 0.35 + epss * 0.30 + blast * 0.25 + rel * 0.10) * 100;
  return Math.round(Math.min(Math.max(score, 0), 100));
}

export function riskTier(score) {
  if (score == null) return 'unknown';
  if (score >= 75) return 'critical';
  if (score >= 50) return 'high';
  if (score >= 25) return 'medium';
  return 'low';
}

const SEVERITY_BASE = {
  Critical: { downtime: 24, cost: 50000 },
  High: { downtime: 8, cost: 20000 },
  Medium: { downtime: 2, cost: 5000 },
  Low: { downtime: 0.5, cost: 1000 },
};

// Impact estimate driven by severity × matched portfolio product breadth.
export function estimateImpactFromMatch(severity, matchedProductCount) {
  const base = SEVERITY_BASE[severity] || SEVERITY_BASE.Medium;
  const count = Math.max(1, matchedProductCount || 0);
  return {
    estimated_downtime_hours: Math.round(base.downtime * count * 10) / 10,
    estimated_recovery_cost: Math.round(base.cost * count),
  };
}