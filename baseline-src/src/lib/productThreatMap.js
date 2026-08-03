// Maps threat records to product portfolio items (derived from affected_products,
// falling back to the threat title) and aggregates per-product risk metrics.
// "At risk" weighting is driven by currently ACTIVE (non-mitigated) threats.
const sevRank = { Critical: 4, High: 3, Medium: 2, Low: 1 };

export function parseProducts(threat) {
  const raw = threat.affected_products || threat.title || "";
  const list = raw
    .split(/[,;|]/)
    .map((s) => s.trim())
    .filter(Boolean);
  return list.length ? list : ["Unspecified"];
}

// Matches a derived product name to a tracked Product asset (exact, then substring).
export function matchAsset(name, assets = []) {
  if (!name || !assets.length) return null;
  const target = name.toLowerCase();
  return (
    assets.find((a) => (a.name || "").toLowerCase() === target) ||
    assets.find((a) => {
      const an = (a.name || "").toLowerCase();
      return an && (target.includes(an) || an.includes(target));
    }) ||
    null
  );
}

export function mapThreatsToProducts(threats, assets = []) {
  const map = {};
  threats.forEach((t) => {
    const active = t.status !== "Mitigated";
    parseProducts(t).forEach((name) => {
      if (!map[name]) {
        map[name] = {
          name,
          threats: [],
          count: 0,
          critical: 0,
          active: 0,
          activeCritical: 0,
          activeHigh: 0,
          riskScore: 0,
          maxCvss: 0,
          topSeverity: "Low",
          cves: new Set(),
        };
      }
      const p = map[name];
      p.threats.push(t);
      p.count += 1;
      if (t.severity === "Critical") p.critical += 1;
      if (active) {
        p.active += 1;
        p.riskScore += sevRank[t.severity] || 0;
        if (t.severity === "Critical") p.activeCritical += 1;
        if (t.severity === "High") p.activeHigh += 1;
      }
      if ((t.cvss_score || 0) > p.maxCvss) p.maxCvss = t.cvss_score || 0;
      if (sevRank[t.severity] > sevRank[p.topSeverity]) p.topSeverity = t.severity;
      if (t.cve_id) p.cves.add(t.cve_id);
    });
  });
  return Object.values(map)
    .map((p) => ({ ...p, asset: matchAsset(p.name, assets) }))
    .sort(
      (a, b) =>
        b.activeCritical - a.activeCritical ||
        b.riskScore - a.riskScore ||
        b.active - a.active ||
        b.count - a.count
    );
}

// Risk tier derived from currently active threat severity on the product.
export function riskTier(p) {
  if (p.activeCritical > 0) return "critical";
  if (p.activeHigh > 0) return "high";
  return "moderate";
}