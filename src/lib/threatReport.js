// Generates a downloadable PDF investigation report for a single threat,
// including investigation steps, blast-radius (affected product) assessment,
// and impact (downtime + recovery cost) estimates.
import { jsPDF } from "jspdf";
import { INVESTIGATION_STEPS } from "@/lib/investigationTemplate";
import { estimateImpact, formatCost } from "@/lib/impactAssessment";

const PRIMARY = [6, 95, 120];
const INK = [30, 41, 59];
const MUTED = [120, 130, 145];
const LINE = [210, 216, 224];

const STEP_LABEL = { done: "Completed", pending: "In progress", not_started: "Not started" };
const TIER_LABEL = {
  critical: "Critical — Most At Risk",
  high: "High",
  moderate: "Moderate",
};

function stepStatuses(activity) {
  const stepEntries = (activity || []).filter((a) => a.action === "investigation_step");
  const started = stepEntries.length > 0;
  return INVESTIGATION_STEPS.map((step) => {
    const entries = stepEntries.filter(
      (a) => a.description && a.description.startsWith(step.label)
    );
    if (!entries.length) return started ? "pending" : "not_started";
    return entries[0].new_value === "done" ? "done" : "pending";
  });
}

export function generateThreatReport(threat, { activity = [] } = {}) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;
  const maxW = pageW - margin * 2;
  let y = margin;

  const ensure = (h) => {
    if (y + h > pageH - margin - 24) {
      doc.addPage();
      y = margin;
    }
  };

  const para = (str, size, color, { bold = false, indent = 0 } = {}) => {
    if (!str) return;
    doc.setFontSize(size);
    doc.setTextColor(...color);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    const lines = doc.splitTextToSize(String(str), maxW - indent);
    lines.forEach((ln) => {
      ensure(size + 5);
      doc.text(ln, margin + indent, y);
      y += size + 5;
    });
  };

  const spacer = (h = 8) => {
    y += h;
  };

  const sectionHeader = (title) => {
    ensure(36);
    doc.setFillColor(...PRIMARY);
    doc.roundedRect(margin, y, maxW, 26, 4, 4, "F");
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.text(title.toUpperCase(), margin + 10, y + 17);
    y += 34;
  };

  const kv = (k, v) => {
    const val = v == null || v === "" ? "—" : String(v);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...MUTED);
    const valLines = doc.splitTextToSize(val, maxW - 140);
    const rowH = Math.max(14, valLines.length * 12) + 4;
    ensure(rowH);
    doc.text(k, margin, y + 9);
    doc.setTextColor(...INK);
    doc.setFont("helvetica", "bold");
    doc.text(valLines, margin + 140, y + 9);
    y += rowH;
  };

  const hr = () => {
    ensure(10);
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.8);
    doc.line(margin, y, margin + maxW, y);
    y += 10;
  };

  // ---- Title block ----
  doc.setFillColor(...PRIMARY);
  doc.rect(0, 0, pageW, 6, "F");
  doc.setFontSize(16);
  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold");
  doc.text("ThreatPulse — Threat Investigation Report", margin, y + 4);
  y += 22;
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.setFont("helvetica", "normal");
  doc.text(`Generated ${new Date().toLocaleString()}`, margin, y);
  y += 18;

  // ---- Summary ----
  sectionHeader("Threat Summary");
  para(threat.title || "Untitled threat", 13, INK, { bold: true });
  spacer(4);
  kv("Severity", threat.severity);
  kv("Status", threat.status);
  kv("Type", threat.type);
  kv("Source", threat.source);
  kv("CVE ID", threat.cve_id);
  kv("CVSS Score", threat.cvss_score);
  kv("Affected Products", threat.affected_products);
  kv("Assigned To", threat.assigned_to);
  kv("Detected", threat.created_date ? new Date(threat.created_date).toLocaleString() : "—");
  kv("First Response", threat.first_response_date ? new Date(threat.first_response_date).toLocaleString() : "—");
  kv("Closed", threat.closed_date ? new Date(threat.closed_date).toLocaleString() : "—");
  spacer(4);
  if (threat.description) {
    para(threat.description, 9, INK);
  }
  if (threat.source_url) {
    para(`Source URL: ${threat.source_url}`, 8, MUTED);
  }
  spacer(6);

  // ---- Investigation Steps ----
  sectionHeader("Investigation Steps");
  const statuses = stepStatuses(activity);
  const completed = statuses.filter((s) => s === "done").length;
  para(`Standardized workflow — ${completed}/${INVESTIGATION_STEPS.length} steps complete.`, 9, MUTED);
  spacer(4);
  INVESTIGATION_STEPS.forEach((step, idx) => {
    const st = statuses[idx];
    const mark = st === "done" ? "[x]" : st === "pending" ? "[~]" : "[ ]";
    para(`${mark}  ${idx + 1}. ${step.label} — ${STEP_LABEL[st]}`, 10, INK, { bold: true });
    para(step.guidance, 9, MUTED, { indent: 22 });
    spacer(4);
  });
  spacer(6);

  // ---- Blast Radius Assessment ----
  sectionHeader("Blast Radius Assessment");
  const affected = (threat.affected_products || "")
    .split(/[,;|]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const active = threat.status !== "Mitigated";
  const tier = !active
    ? "moderate"
    : threat.severity === "Critical"
    ? "critical"
    : threat.severity === "High"
    ? "high"
    : "moderate";
  para(
    `Risk tier (current active severity): ${TIER_LABEL[tier]}`,
    10,
    INK,
    { bold: true }
  );
  spacer(4);
  if (affected.length) {
    para(`Affected product portfolio (${affected.length}):`, 9, MUTED);
    affected.forEach((name) => {
      para(`• ${name} — ${TIER_LABEL[tier]}`, 9, INK, { indent: 14 });
    });
  } else {
    para("No specific affected products recorded for this threat.", 9, MUTED);
  }
  spacer(6);

  // ---- Impact Assessment ----
  sectionHeader("Impact Assessment");
  const hasStored =
    threat.estimated_downtime_hours != null || threat.estimated_recovery_cost != null;
  const impact = hasStored
    ? { downtimeHours: threat.estimated_downtime_hours, recoveryCost: threat.estimated_recovery_cost }
    : estimateImpact(threat);
  kv("Estimated Downtime", `${impact.downtimeHours} hours`);
  kv("Estimated Recovery Cost", formatCost(impact.recoveryCost));
  kv("Affected Product Count", affected.length || 1);
  para(
    `Estimate derived from severity (${threat.severity}) and affected product portfolio breadth.`,
    8,
    MUTED
  );
  spacer(6);

  // ---- Activity Timeline ----
  sectionHeader("Activity Timeline");
  const entries = (activity || []).slice(0, 25);
  if (!entries.length) {
    para("No activity logged yet.", 9, MUTED);
  } else {
    entries.forEach((a) => {
      const when = a.created_date ? new Date(a.created_date).toLocaleString() : "";
      para(`${when} — ${a.actor_name || "System"} (${a.action})`, 9, INK, { bold: true });
      para(a.description || "", 9, MUTED, { indent: 14 });
      spacer(3);
    });
  }

  // ---- Footer on every page ----
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.6);
    doc.line(margin, pageH - 28, pageW - margin, pageH - 28);
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.setFont("helvetica", "normal");
    doc.text("ThreatPulse Intelligence Report", margin, pageH - 16);
    doc.text(`Threat ID: ${threat.id}`, pageW / 2, pageH - 16, { align: "center" });
    doc.text(`Page ${i} of ${pages}`, pageW - margin, pageH - 16, { align: "right" });
  }

  doc.save(`threat-${threat.cve_id || threat.id}.pdf`);
}