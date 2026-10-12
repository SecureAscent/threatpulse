import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// SLA timeframes (hours) — must mirror src/lib/threatSla.js
const SLA_HOURS = { Critical: 1, High: 4, Medium: 24, Low: 72 };
const HIGH_SEVERITIES = ["Critical", "High"];

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const threats = await base44.asServiceRole.entities.Threat.list("-created_date", 500);
    const now = Date.now();

    // Find active high-severity threats past their SLA that haven't been alerted yet
    const breached = threats.filter((t) => {
      if (!t || !t.created_date) return false;
      if (t.status === "Mitigated") return false;
      if (!HIGH_SEVERITIES.includes(t.severity)) return false;
      if (t.sla_alert_sent) return false;
      const slaMs = (SLA_HOURS[t.severity] || 24) * 3600000;
      return (now - new Date(t.created_date).getTime()) > slaMs;
    });

    if (breached.length === 0) {
      return Response.json({ status: "success", breached: 0, alerted: 0 });
    }

    // Alert admin users; fall back to all users if no admins
    const users = await base44.asServiceRole.entities.User.list();
    const recipients = users
      .filter((u) => ["admin", "superadmin"].includes((u.role || "").toLowerCase()))
      .map((u) => u.email)
      .filter(Boolean);
    if (recipients.length === 0) {
      recipients.push(...users.map((u) => u.email).filter(Boolean));
    }

    let alerted = 0;
    const errors = [];
    for (const t of breached) {
      const slaH = SLA_HOURS[t.severity];
      const subject = `[SLA Breach] ${t.severity} threat unresolved beyond ${slaH}h SLA`;
      const body = [
        `A ${t.severity} severity threat has not been mitigated within its SLA timeframe of ${slaH} hours.`,
        "",
        `Title: ${t.title}`,
        `CVE: ${t.cve_id || "n/a"}`,
        `Source: ${t.source || "n/a"}`,
        `Status: ${t.status}`,
        `Assigned to: ${t.assigned_to || "Unassigned"}`,
        `Created: ${t.created_date}`,
        "",
        `Open the investigation: https://threatpulseintel.com/threats/${t.id}`,
      ].join("\n");

      for (const email of recipients) {
        try {
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: email,
            subject,
            body,
            from_name: "ThreatPulse SLA Monitor",
          });
        } catch (e) {
          errors.push(`${email}: ${e.message}`);
        }
      }
      await base44.asServiceRole.entities.Threat.update(t.id, { sla_alert_sent: true });
      alerted++;
    }

    return Response.json({
      status: "success",
      breached: breached.length,
      alerted,
      recipients: recipients.length,
      errors,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}