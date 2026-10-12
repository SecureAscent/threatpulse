// Advanced threat analytics: composite risk scoring, CVE-product correlation,
// trend forecasting (moving average + linear projection), and anomaly detection.

const sevRank = { Critical: 4, High: 3, Medium: 2, Low: 1 };
const sevPoints = { Critical: 25, High: 18, Medium: 10, Low: 5 };

// Composite risk score (0-100) blending CVSS, EPSS, severity, and active status.
// Weights: CVSS 30, EPSS 30, severity 25, active status 15.
export function compositeRiskScore(threat) {
  const cvss = Math.min((threat.cvss_score || 0) / 10, 1) * 30;
  const epss = Math.min(threat.epss_score || 0, 1) * 30;
  const sev = sevPoints[threat.severity] || 5;
  const active = threat.status === "Mitigated" ? 0 : 15;
  return Math.round(cvss + epss + sev + active);
}

export function riskTier(score) {
  if (score >= 75) return { label: "Critical", color: "#ef4444", bg: "bg-red-500/10 text-red-500 border-red-500/20" };
  if (score >= 55) return { label: "High", color: "#f97316", bg: "bg-orange-500/10 text-orange-500 border-orange-500/20" };
  if (score >= 35) return { label: "Elevated", color: "#eab308", bg: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" };
  return { label: "Moderate", color: "#3b82f6", bg: "bg-blue-500/10 text-blue-500 border-blue-500/20" };
}

// Build CVE → products correlation data.
// Returns { cves: [{cve_id, products, productCount, threatCount, maxSeverity, maxScore }], products: [...] }
export function cveProductCorrelation(threats) {
  const cveMap = {};
  const productSet = new Set();

  threats.forEach((t) => {
    if (!t.cve_id) return;
    const products = parseProducts(t);
    products.forEach((p) => productSet.add(p));

    if (!cveMap[t.cve_id]) {
      cveMap[t.cve_id] = {
        cve_id: t.cve_id,
        products: new Set(),
        threatCount: 0,
        maxSeverity: t.severity,
        maxScore: compositeRiskScore(t),
        cvss: t.cvss_score || 0,
        epss: t.epss_score || 0,
      };
    }
    const entry = cveMap[t.cve_id];
    entry.threatCount += 1;
    products.forEach((p) => entry.products.add(p));
    if ((sevRank[t.severity] || 0) > (sevRank[entry.maxSeverity] || 0)) entry.maxSeverity = t.severity;
    const score = compositeRiskScore(t);
    if (score > entry.maxScore) entry.maxScore = score;
  });

  const cves = Object.values(cveMap)
    .map((c) => ({
      ...c,
      products: Array.from(c.products),
      productCount: c.products.size,
    }))
    .sort((a, b) => b.productCount - a.productCount || b.maxScore - a.maxScore);

  return { cves, products: Array.from(productSet).sort() };
}

function parseProducts(threat) {
  const raw = threat.affected_products || threat.title || "";
  const list = raw.split(/[,;|]/).map((s) => s.trim()).filter(Boolean);
  return list.length ? list : ["Unspecified"];
}

// Daily threat counts for a sliding window.
export function dailyCounts(threats, days) {
  return Array.from({ length: days }).map((_, i) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (days - 1 - i));
    const next = new Date(d);
    next.setDate(d.getDate() + 1);
    const dayThreats = threats.filter((t) => {
      const td = new Date(t.created_date);
      return td >= d && td < next;
    });
    return {
      date: d,
      day: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      total: dayThreats.length,
      critical: dayThreats.filter((t) => t.severity === "Critical").length,
    };
  });
}

// Simple linear regression for projection.
function linearRegression(points) {
  const n = points.length;
  if (n < 2) return { slope: 0, intercept: points[0]?.y || 0 };
  const sumX = points.reduce((s, p, i) => s + i, 0);
  const sumY = points.reduce((s, p) => s + p.y, 0);
  const sumXY = points.reduce((s, p, i) => s + i * p.y, 0);
  const sumX2 = points.reduce((s, _, i) => s + i * i, 0);
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX || 1);
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

// Forecast trend data: historical daily counts + 7-day moving average + 7-day projection.
export function forecastTrend(threats, days) {
  const historical = dailyCounts(threats, days);

  // 7-day moving average overlay
  const maWindow = 7;
  const withMA = historical.map((d, i) => {
    const start = Math.max(0, i - maWindow + 1);
    const slice = historical.slice(start, i + 1);
    const avg = slice.reduce((s, x) => s + x.total, 0) / slice.length;
    return { ...d, movingAvg: Math.round(avg * 10) / 10 };
  });

  // Linear projection from the last 14 days (or all if fewer)
  const projPoints = historical.slice(-Math.min(14, historical.length)).map((d, i) => ({ x: i, y: d.total }));
  const { slope, intercept } = linearRegression(projPoints);

  // Project 7 days forward
  const lastDate = historical[historical.length - 1]?.date || new Date();
  const projections = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(lastDate);
    d.setDate(d.getDate() + (i + 1));
    const projIndex = projPoints.length - 1 + i + 1;
    const projected = Math.max(0, Math.round(slope * projIndex + intercept));
    return {
      date: d,
      day: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      total: null,
      projected,
    };
  });

  // Anomaly detection: flag days > mean + 2*stddev
  const counts = historical.map((d) => d.total);
  const mean = counts.reduce((s, c) => s + c, 0) / (counts.length || 1);
  const variance = counts.reduce((s, c) => s + (c - mean) ** 2, 0) / (counts.length || 1);
  const stdDev = Math.sqrt(variance);
  const threshold = mean + 2 * stdDev;

  const withAnomalies = withMA.map((d) => ({
    ...d,
    anomaly: d.total > threshold && stdDev > 0 ? d.total : null,
  }));

  return {
    data: [...withAnomalies, ...projections],
    stats: {
      mean: Math.round(mean * 10) / 10,
      stdDev: Math.round(stdDev * 10) / 10,
      threshold: Math.round(threshold * 10) / 10,
      slope: Math.round(slope * 100) / 100,
    },
  };
}

// Top threats ranked by composite risk score.
export function riskLeaderboard(threats, limit = 15) {
  return threats
    .map((t) => ({ ...t, riskScore: compositeRiskScore(t) }))
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, limit);
}