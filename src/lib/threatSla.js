const SLA_HOURS = { Critical: 1, High: 4, Medium: 24, Low: 72 };

export function getSlaHours(severity) {
  return SLA_HOURS[severity] || 24;
}

export function computeSla(threat) {
  if (!threat || !threat.created_date) return null;
  const created = new Date(threat.created_date).getTime();
  const slaMs = (SLA_HOURS[threat.severity] || 24) * 3600000;
  const closed = threat.closed_date ? new Date(threat.closed_date).getTime() : null;
  const now = Date.now();
  const elapsed = (closed || now) - created;
  const remaining = slaMs - elapsed;
  return {
    slaMs,
    elapsed,
    remaining,
    pct: Math.min(100, Math.max(0, (elapsed / slaMs) * 100)),
    breached: remaining < 0 && !closed,
    resolved: !!closed,
  };
}

export function formatDuration(ms) {
  const neg = ms < 0;
  const a = Math.abs(ms);
  const h = Math.floor(a / 3600000);
  const m = Math.floor((a % 3600000) / 60000);
  if (h > 0) return `${neg ? "-" : ""}${h}h ${m}m`;
  const s = Math.floor((a % 60000) / 1000);
  return `${neg ? "-" : ""}${m}m ${s}s`;
}

export const SLA_LABELS = {
  Critical: "Immediate (1h escalation)",
  High: "4 hours",
  Medium: "24 hours",
  Low: "72 hours",
};