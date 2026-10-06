import { batchMatchThreats } from "@/lib/productCpeMatch";

export const BRIEF_PERIODS = [
  { key: "weekly", label: "Weekly", days: 7 },
  { key: "monthly", label: "Monthly", days: 30 },
  { key: "quarterly", label: "Quarterly", days: 90 },
  { key: "yearly", label: "Yearly", days: 365 },
];

export function periodHeading(periodKey, now = new Date()) {
  if (periodKey === "weekly") {
    return `WEEK OF ${now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`;
  }
  if (periodKey === "monthly") {
    return now.toLocaleDateString("en-US", { month: "long", year: "numeric" }).toUpperCase();
  }
  if (periodKey === "quarterly") {
    const q = Math.floor(now.getMonth() / 3) + 1;
    return `Q${q} ${now.getFullYear()}`;
  }
  return `${now.getFullYear()}`;
}

export function periodVolumeLabel(days) {
  if (days <= 7) return "7-day volume";
  if (days <= 31) return "monthly volume";
  if (days <= 92) return "quarterly volume";
  return "yearly volume";
}

export function filterByDays(threats, days) {
  const since = Date.now() - days * 86400000;
  return threats.filter((t) => new Date(t.created_date).getTime() >= since);
}

export function computeBriefStats(inRange) {
  const newCves = inRange.filter((t) => t.cve_id).length || inRange.length;
  const critical = inRange.filter((t) => t.severity === "Critical").length;
  const high = inRange.filter((t) => t.severity === "High").length;
  const kevCount = inRange.filter((t) => (t.source || "") === "CISA KEV").length;
  const pct = (n) => (newCves ? Math.round((n / newCves) * 1000) / 10 : 0);
  return { newCves, critical, high, kevCount, criticalPct: pct(critical), highPct: pct(high) };
}

export function priorityVulns(inRange, limit = 6) {
  const candidates = inRange.filter(
    (t) => t.severity === "Critical" || (t.source || "") === "CISA KEV" || t.zero_day
  );
  return candidates
    .sort((a, b) => (b.cvss_score || 0) - (a.cvss_score || 0))
    .slice(0, limit)
    .map((t) => {
      let status = "HIGH";
      if (t.zero_day) status = "ZERO-DAY ACTIVE";
      else if ((t.source || "") === "CISA KEV") status = "CISA KEV";
      else if (t.severity === "Critical") status = "CRITICAL";
      return {
        cve_id: t.cve_id || null,
        title: t.affected_products || t.title,
        description: t.description || t.title,
        status,
      };
    });
}

export function exposureMatches(inRange, products) {
  const matchMap = batchMatchThreats(inRange, products);
  const matched = inRange.filter((t) => (matchMap[t.id] || []).length > 0);
  return { count: matched.length, matched };
}