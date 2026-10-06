export const TIME_RANGES = [
  { label: "24 Hours", hours: 24, short: "24h" },
  { label: "7 Days", hours: 168, short: "7d" },
  { label: "30 Days", hours: 720, short: "30d" },
  { label: "90 Days", hours: 2160, short: "90d" },
];

export function getRangeStart(hours) {
  return new Date(Date.now() - hours * 3600000);
}

export function filterByRange(threats, hours) {
  const cutoff = getRangeStart(hours);
  return threats.filter((t) => new Date(t.created_date) >= cutoff);
}

export function computeKPIs(threats) {
  const total = threats.length;
  const critical = threats.filter((t) => t.severity === "Critical").length;
  const high = threats.filter((t) => t.severity === "High").length;
  const cves = new Set(threats.filter((t) => t.cve_id).map((t) => t.cve_id));
  const products = new Set();
  threats.forEach((t) => {
    if (t.affected_products) {
      t.affected_products.split(/[,;|]/).forEach((p) => {
        const trimmed = p.trim();
        if (trimmed) products.add(trimmed.toLowerCase());
      });
    }
  });

  const responded = threats.filter((t) => t.first_response_date);
  const avgResponseMs = responded.length
    ? responded.reduce((s, t) => s + (new Date(t.first_response_date) - new Date(t.created_date)), 0) / responded.length
    : 0;

  const mitigated = threats.filter((t) => t.status === "Mitigated").length;
  const mitigationRate = total ? Math.round((mitigated / total) * 100) : 0;

  return {
    total,
    critical,
    high,
    criticalHigh: critical + high,
    uniqueCves: cves.size,
    impactedProducts: products.size,
    avgResponseMs,
    mitigationRate,
    mitigated,
    open: total - mitigated,
  };
}

export function severityDistribution(threats) {
  const order = ["Critical", "High", "Medium", "Low"];
  return order
    .map((s) => ({
      name: s,
      value: threats.filter((t) => t.severity === s).length,
    }))
    .filter((d) => d.value > 0);
}

export function buildTrendData(threats, hours) {
  const now = Date.now();
  const start = now - hours * 3600000;

  if (hours <= 24) {
    return Array.from({ length: 12 }).map((_, i) => {
      const bucketStart = start + (i * hours * 3600000) / 12;
      const bucketEnd = bucketStart + (hours * 3600000) / 12;
      const created = threats.filter((t) => {
        const d = new Date(t.created_date).getTime();
        return d >= bucketStart && d < bucketEnd;
      }).length;
      return {
        label: new Date(bucketStart).toLocaleTimeString(undefined, { hour: "numeric" }),
        created,
      };
    });
  }

  const days = Math.min(Math.ceil(hours / 24), 90);
  return Array.from({ length: days }).map((_, i) => {
    const bucketStart = start + i * 86400000;
    const bucketEnd = bucketStart + 86400000;
    const d = new Date(bucketStart);
    const created = threats.filter((t) => {
      const td = new Date(t.created_date).getTime();
      return td >= bucketStart && td < bucketEnd;
    }).length;
    const mitigated = threats.filter((t) => {
      if (!t.closed_date) return false;
      const td = new Date(t.closed_date).getTime();
      return td >= bucketStart && td < bucketEnd;
    }).length;
    return {
      label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      created,
      mitigated,
    };
  });
}

export function topCves(threats, limit = 10) {
  return threats
    .filter((t) => t.cve_id)
    .sort((a, b) => (b.cvss_score || 0) - (a.cvss_score || 0))
    .slice(0, limit);
}

export function impactedProducts(threats, limit = 10) {
  const map = {};
  threats.forEach((t) => {
    if (t.affected_products) {
      t.affected_products.split(/[,;|]/).forEach((p) => {
        const name = p.trim();
        if (name) {
          const key = name.toLowerCase();
          if (!map[key]) map[key] = { name, count: 0, critical: 0 };
          map[key].count++;
          if (t.severity === "Critical") map[key].critical++;
        }
      });
    }
  });
  return Object.values(map).sort((a, b) => b.count - a.count).slice(0, limit);
}

export function fmtDuration(ms) {
  if (!ms || !isFinite(ms)) return "—";
  const h = ms / 3600000;
  if (h < 1) return `${Math.round(h * 60)}m`;
  if (h < 24) return `${h.toFixed(1)}h`;
  return `${(h / 24).toFixed(1)}d`;
}

export function rangeLabel(hours) {
  const r = TIME_RANGES.find((r) => r.hours === hours);
  return r ? r.label : "Custom";
}