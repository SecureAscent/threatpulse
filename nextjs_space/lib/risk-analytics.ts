// Advanced threat analytics: composite risk scoring, CVE-product correlation,
// and risk leaderboard — adapted for the Docker stack Threat model.

const sevRank: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
const sevPoints: Record<string, number> = { CRITICAL: 25, HIGH: 18, MEDIUM: 10, LOW: 5 };

export interface ThreatLike {
  id: string;
  threatId?: string | null;
  title: string;
  severity: string;
  status: string;
  cvssScore?: number | null;
  epssScore?: number | null;
  epssPercentile?: number | null;
  riskScore?: number | null;
  isKev?: boolean;
  exploitAvailable?: boolean;
  affectedAssets?: string | null;
  mitreAttackIds?: string[] | null;
  source?: string | null;
  dateAdded?: string | null;
}

// Prefer the stored composite riskScore from the intelligence engine.
// Fall back to a CVSS+EPSS+severity heuristic when riskScore is absent.
export function compositeRiskScore(t: ThreatLike): number {
  if (typeof t.riskScore === 'number' && t.riskScore > 0) return t.riskScore;
  const cvss = Math.min((t.cvssScore || 0) / 10, 1) * 40;
  const epss = Math.min(t.epssPercentile || 0, 1) * 25;
  const sev = sevPoints[(t.severity || '').toUpperCase()] || 5;
  const kev = t.isKev ? 20 : 0;
  const exploit = t.exploitAvailable ? 10 : 0;
  return Math.round(cvss + epss + sev + kev + exploit);
}

export function riskTier(score: number) {
  if (score >= 70) return { label: 'Critical', color: '#ef4444', bg: 'bg-red-500/10 text-red-500 border-red-500/20' };
  if (score >= 40) return { label: 'Elevated', color: '#f97316', bg: 'bg-orange-500/10 text-orange-500 border-orange-500/20' };
  if (score >= 20) return { label: 'Moderate', color: '#eab308', bg: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' };
  return { label: 'Low', color: '#3b82f6', bg: 'bg-blue-500/10 text-blue-500 border-blue-500/20' };
}

function parseProducts(t: ThreatLike): string[] {
  const raw = t.affectedAssets || t.title || '';
  const list = raw.split(/[,;|]/).map((s) => s.trim()).filter(Boolean);
  return list.length ? list : ['Unspecified'];
}

// Build CVE -> products correlation data.
export interface CveProductEntry {
  cve_id: string;
  products: string[];
  productCount: number;
  threatCount: number;
  maxSeverity: string;
  maxScore: number;
  cvss: number;
  epss: number;
}

export function cveProductCorrelation(threats: ThreatLike[]) {
  const cveMap: Record<string, any> = {};
  const productSet = new Set<string>();

  threats.forEach((t) => {
    const cve = t.threatId;
    if (!cve) return;
    const products = parseProducts(t);
    products.forEach((p) => productSet.add(p));

    if (!cveMap[cve]) {
      cveMap[cve] = {
        cve_id: cve,
        products: new Set<string>(),
        threatCount: 0,
        maxSeverity: t.severity,
        maxScore: compositeRiskScore(t),
        cvss: t.cvssScore || 0,
        epss: t.epssScore || 0,
      };
    }
    const entry = cveMap[cve];
    entry.threatCount += 1;
    products.forEach((p) => entry.products.add(p));
    if ((sevRank[(t.severity || '').toUpperCase()] || 0) > (sevRank[(entry.maxSeverity || '').toUpperCase()] || 0))
      entry.maxSeverity = t.severity;
    const score = compositeRiskScore(t);
    if (score > entry.maxScore) entry.maxScore = score;
  });

  const cves: CveProductEntry[] = Object.values(cveMap)
    .map((c: any) => ({
      ...c,
      products: Array.from(c.products),
      productCount: c.products.size,
    }))
    .sort((a, b) => b.productCount - a.productCount || b.maxScore - a.maxScore);

  return { cves, products: Array.from(productSet).sort() };
}

// Top threats ranked by composite risk score.
export function riskLeaderboard(threats: ThreatLike[], limit = 15) {
  return threats
    .map((t) => ({ ...t, riskScore: compositeRiskScore(t) }))
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, limit);
}
