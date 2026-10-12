// Impact assessment: estimates potential system downtime and recovery cost
// from a threat's severity and the breadth of its affected product portfolio.

const SEVERITY_BASE = {
  Critical: { downtime: 24, cost: 50000 },
  High: { downtime: 8, cost: 20000 },
  Medium: { downtime: 2, cost: 5000 },
  Low: { downtime: 0.5, cost: 1000 },
};

export function parseAffectedProducts(threat) {
  const raw = threat.affected_products || "";
  const list = raw
    .split(/[,;|]/)
    .map((s) => s.trim())
    .filter(Boolean);
  return list.length ? list : [threat.title || "Unspecified"];
}

export function estimateImpact(threat) {
  const base = SEVERITY_BASE[threat.severity] || SEVERITY_BASE.Medium;
  const productCount = Math.max(1, parseAffectedProducts(threat).length);
  return {
    downtimeHours: Math.round(base.downtime * productCount * 10) / 10,
    recoveryCost: Math.round(base.cost * productCount),
    productCount,
  };
}

export function formatCost(n) {
  if (n == null) return "—";
  return `$${Number(n).toLocaleString()}`;
}