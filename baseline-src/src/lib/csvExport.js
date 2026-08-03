// Lightweight CSV export helpers for stakeholder-friendly spreadsheet sharing.

export function escapeCell(v) {
  if (v == null) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function rowsToCsv(rows) {
  return rows.map((r) => (Array.isArray(r) ? r.map(escapeCell).join(",") : escapeCell(r))).join("\r\n");
}

export function downloadCsv(filename, csv) {
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const LIST_COLS = [
  ["Title", "title"],
  ["Severity", "severity"],
  ["Type", "type"],
  ["Status", "status"],
  ["CVE ID", "cve_id"],
  ["CVSS", "cvss_score"],
  ["Source", "source"],
  ["Assigned To", "assigned_to"],
  ["Affected Products", "affected_products"],
  ["Created Date", "created_date"],
  ["First Response", "first_response_date"],
  ["Closed Date", "closed_date"],
  ["Est. Downtime (h)", "estimated_downtime_hours"],
  ["Recovery Cost (USD)", "estimated_recovery_cost"],
  ["Source URL", "source_url"],
  ["Threat ID", "id"],
];

export function buildThreatListCSV(threats) {
  const rows = [LIST_COLS.map((c) => c[0])];
  (threats || []).forEach((t) => rows.push(LIST_COLS.map((c) => t[c[1]] ?? "")));
  return rowsToCsv(rows);
}

export function buildThreatInvestigationCSV(threat, activity = [], comments = []) {
  const rows = [];
  rows.push(["Field", "Value"]);
  const summary = [
    ["Threat ID", threat.id],
    ["Title", threat.title],
    ["Severity", threat.severity],
    ["Type", threat.type],
    ["Status", threat.status],
    ["CVE ID", threat.cve_id],
    ["CVSS Score", threat.cvss_score],
    ["Source", threat.source],
    ["Source URL", threat.source_url],
    ["Assigned To", threat.assigned_to],
    ["Affected Products", threat.affected_products],
    ["Created Date", threat.created_date],
    ["First Response", threat.first_response_date],
    ["Closed Date", threat.closed_date],
    ["Est. Downtime (h)", threat.estimated_downtime_hours],
    ["Recovery Cost (USD)", threat.estimated_recovery_cost],
    ["Analyst Notes", threat.notes],
  ];
  summary.forEach(([k, v]) => rows.push([k, v ?? ""]));

  rows.push([]);
  rows.push(["Timestamp", "Actor", "Action", "Description", "Old Value", "New Value"]);
  (activity || []).forEach((a) =>
    rows.push([a.created_date, a.actor_name, a.action, a.description, a.old_value, a.new_value])
  );

  rows.push([]);
  rows.push(["Timestamp", "Author", "Mentions", "Comment"]);
  (comments || []).forEach((c) =>
    rows.push([c.created_date, c.actor_name, c.mentions, c.body])
  );

  return rowsToCsv(rows);
}