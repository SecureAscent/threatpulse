import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { secrets } from 'base44:runtime';
import { matchThreatToProducts } from "../../shared/threatScoring.ts";

const FROM_EMAIL = "ThreatPulse Intelligence <noreply@threatpulseintel.com>";
const DAY_MS = 24 * 60 * 60 * 1000;

const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function within(iso, since, now) {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return t >= since && t <= now;
}

function periodInfo(days, now = new Date()) {
  if (days <= 7) {
    return {
      key: "weekly",
      label: "Weekly",
      heading: `WEEK OF ${now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`,
      volumeLabel: "7-day volume",
    };
  }
  if (days <= 31) {
    return {
      key: "monthly",
      label: "Monthly",
      heading: now.toLocaleDateString("en-US", { month: "long", year: "numeric" }).toUpperCase(),
      volumeLabel: "monthly volume",
    };
  }
  if (days <= 92) {
    const q = Math.floor(now.getMonth() / 3) + 1;
    return { key: "quarterly", label: "Quarterly", heading: `Q${q} ${now.getFullYear()}`, volumeLabel: "quarterly volume" };
  }
  return { key: "yearly", label: "Yearly", heading: `${now.getFullYear()}`, volumeLabel: "yearly volume" };
}

// A threat is a CISA KEV add when either its primary source OR any of its
// merged alternate_sources is "CISA KEV". Ingest merge-dedup keeps one record
// per CVE, so a CVE first seen from NVD carries "CISA KEV" only in
// alternate_sources — checking source alone undercounts KEV adds.
function isCisaKev(t) {
  if ((t.source || "").trim().toLowerCase() === "cisa kev") return true;
  const alts = (t.alternate_sources || "")
    .split(/[,;|]/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return alts.includes("cisa kev");
}

function computeStats(threats) {
  const total = threats.length;
  const cveCount = threats.filter((t) => t.cve_id).length;
  const critical = threats.filter((t) => t.severity === "Critical").length;
  const high = threats.filter((t) => t.severity === "High").length;
  const kevCount = threats.filter((t) => isCisaKev(t)).length;
  const pct = (n) => (total ? Math.round((n / total) * 1000) / 10 : 0);
  return { total, cveCount, critical, high, kevCount, criticalPct: pct(critical), highPct: pct(high) };
}

function priorityVulns(threats, limit = 6) {
  const candidates = threats.filter(
    (t) => t.severity === "Critical" || isCisaKev(t) || t.zero_day
  );
  return candidates
    .sort((a, b) => (b.cvss_score || 0) - (a.cvss_score || 0))
    .slice(0, limit)
    .map((t) => {
      let status = "HIGH";
      if (t.zero_day) status = "ZERO-DAY ACTIVE";
      else if (isCisaKev(t)) status = "CISA KEV";
      else if (t.severity === "Critical") status = "CRITICAL";
      return { cve_id: t.cve_id || null, title: t.title, status };
    });
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);

    let body = {};
    try { body = await req.json(); } catch {}
    const windowDays = Number(body.days) > 0 ? Number(body.days) : 7;
    const windowMs = windowDays * DAY_MS;
    const now = Date.now();
    const since = now - windowMs;
    const period = periodInfo(windowDays);

    // --- Gather intelligence data ---
    const [threats, products] = await Promise.all([
      base44.asServiceRole.entities.Threat.list("-created_date", 500),
      base44.asServiceRole.entities.Product.list(),
    ]);

    const inRange = threats.filter((t) => within(t.created_date, since, now));
    const stats = computeStats(inRange);
    const vulns = priorityVulns(inRange);

    // Portfolio match count — use the shared CPE/keyword/vendor matcher so the
    // email agrees with the frontend briefing's correlation logic exactly.
    const portfolioMatches = inRange.filter((t) => matchThreatToProducts(t, products).length > 0);

    // --- LLM narrative ---
    const context = {
      period: period.label,
      stats,
      top_vulnerabilities: vulns,
      ransomware_names: [...new Set(inRange.filter((t) => t.type === "Ransomware").map((t) => t.title))].slice(0, 6),
      portfolio_match_count: portfolioMatches.length,
      portfolio_matches: portfolioMatches.slice(0, 8).map((t) => ({ cve: t.cve_id, title: t.title })),
    };

    const llmSchema = {
      type: "object",
      properties: {
        executive_summary: { type: "string", description: "3-4 sentence paragraph" },
        landscape_bullets: { type: "array", items: { type: "string" }, description: "4-6 short bullet strings" },
        attack_surface_title: { type: "string", description: "2-4 word label" },
        attack_surface_description: { type: "string", description: "1-2 sentence explanation" },
        exposure_items: { type: "array", items: { type: "string" }, description: "3-5 validation-priority bullets" },
        action_immediate: { type: "string" },
        action_this_week: { type: "string" },
        action_ongoing: { type: "string" },
        key_takeaway: { type: "string", description: "2-3 sentence closing statement" },
      },
    };

    const prompt = [
      "You are the chief intelligence analyst at ThreatPulse Intel writing a branded executive cyber threat brief",
      "for C-suite leadership. Use ONLY the real data below — never invent CVEs or numbers.",
      "",
      "Return:",
      "- executive_summary: 3-4 sentence paragraph summarizing volume, critical vulns, CISA KEV adds, and the most urgent risks (name specific CVEs/products from the data).",
      "- landscape_bullets: 4-6 short bullet strings (no bullet prefix) covering volume, critical/high counts, KEV adds, notable exploitation, ransomware activity.",
      "- attack_surface_title: 2-4 word label for the primary attack surface this period (e.g. 'EDGE INFRASTRUCTURE', 'EDGE + IDENTITY').",
      "- attack_surface_description: 1-2 sentence explanation.",
      "- exposure_items: 3-5 short validation-priority bullet strings for the security team.",
      "- action_immediate / action_this_week / action_ongoing: one short actionable sentence each.",
      "- key_takeaway: 2-3 sentence closing statement for leadership.",
      "",
      "DATA:",
      JSON.stringify(context, null, 2),
    ].join("\n");

    const llm = await base44.asServiceRole.integrations.Core.InvokeLLM({ prompt, response_json_schema: llmSchema });
    const n = (llm && typeof llm === "object") ? llm : {};
    const bullets = Array.isArray(n.landscape_bullets) ? n.landscape_bullets : [];
    const exposureItems = Array.isArray(n.exposure_items) ? n.exposure_items : [];

    const subject = `ThreatPulse Intel — ${period.label} Cyber Threat Intelligence Brief — ${period.heading}`;

    // --- HTML email (dark navy/cyan branded brief) ---
    const STATUS_BG = {
      "ZERO-DAY ACTIVE": "#e11d48",
      "CISA KEV": "#f59e0b",
      CRITICAL: "#f59e0b",
      HIGH: "#475569",
    };

    const statCard = (value, label, sub) => `
      <td style="width:25%;padding:0 4px">
        <div style="background:#0f2135;border:1px solid #1c3350;border-radius:8px;padding:16px 8px;text-align:center">
          <div style="font-size:28px;font-weight:700;color:#ffffff">${esc(value)}</div>
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#22d3ee;margin-top:4px">${esc(label)}</div>
          <div style="font-size:10px;color:#94a3b8;margin-top:2px">${esc(sub)}</div>
        </div>
      </td>`;

    const vulnRows = vulns.length
      ? vulns.map((v) => {
          const bg = STATUS_BG[v.status] || STATUS_BG.HIGH;
          return `<tr>
            <td style="padding:10px 12px;border-bottom:1px solid #1c3350;font-family:monospace;font-size:12px;color:#22d3ee;font-weight:600;width:140px">${esc(v.cve_id || "—")}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #1c3350;font-size:12px;color:#e2e8f0;font-weight:500">${esc(v.title || "—")}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #1c3350;text-align:center;width:120px">
              <span style="display:inline-block;padding:3px 10px;border-radius:4px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#fff;background:${bg}">${esc(v.status)}</span>
            </td>
          </tr>`;
        }).join("")
      : `<tr><td colspan="3" style="padding:16px;font-size:12px;color:#64748b;text-align:center">No critical vulnerabilities in this period.</td></tr>`;

    const bulletHtml = bullets.map((b) => `<li style="margin-bottom:6px;font-size:13px;color:#cbd5e1;line-height:1.5"><span style="color:#22d3ee">›</span> ${esc(b)}</li>`).join("");

    const exposureHtml = exposureItems.map((i) => `<li style="margin-bottom:5px;font-size:12px;color:#cbd5e1;line-height:1.5"><span style="color:#22d3ee">›</span> ${esc(i)}</li>`).join("");

    const exposureHeadline = portfolioMatches.length > 0
      ? `${portfolioMatches.length} Portfolio Match${portfolioMatches.length === 1 ? "" : "es"} Found`
      : "No Confirmed Company-Specific Exposure";
    const exposureColor = portfolioMatches.length > 0 ? "#f59e0b" : "#10b981";

    const html = [
      `<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:auto;background:#0a1526;color:#e2e8f0">`,
      // Top metadata
      `<div style="padding:16px 24px">`,
      `<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#22d3ee">THREATPULSE INTEL // ${period.label.toUpperCase()} THREAT BRIEF //</div>`,
      `<div style="font-size:10px;color:#64748b;margin-top:2px">ThreatPulse Intel • threatpulseintel.com • ${esc(period.heading)} • Executive Intelligence</div>`,
      `</div>`,
      // Hero block
      `<div style="margin:0 24px;background:#0f2135;border-left:4px solid #22d3ee;border-radius:6px;padding:18px 20px">`,
      `<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#22d3ee">ThreatPulse Intel / Cyber Threat Intelligence</div>`,
      `<h1 style="color:#ffffff;font-size:22px;margin:6px 0 4px">${esc(period.label)} Cyber Threat Intelligence Brief</h1>`,
      `<div style="font-size:11px;font-weight:600;text-transform:uppercase;color:#94a3b8">${esc(period.heading)}</div>`,
      `</div>`,
      // Stat cards
      `<table style="width:100%;border-collapse:separate;border-spacing:0;margin:16px 24px 0;width:calc(100% - 48px)"><tr>`,
      statCard(stats.total.toLocaleString(), "New Threats", `${stats.cveCount} with CVE IDs · ${period.volumeLabel}`),
      statCard(stats.critical.toLocaleString(), "Critical", `${stats.criticalPct}% of new threats`),
      statCard(stats.high.toLocaleString(), "High", `${stats.highPct}% of new threats`),
      statCard(stats.kevCount.toLocaleString(), "CISA KEVs", "confirmed exploitation"),
      `</tr></table>`,
      // Executive Summary
      `<div style="margin:16px 24px 0;border:1px solid #1c3350;border-radius:6px;overflow:hidden">`,
      `<div style="background:#0f2135;padding:8px 14px"><span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#22d3ee">2-Minute Read</span><span style="font-size:10px;font-weight:700;text-transform:uppercase;color:#ffffff"> / Executive Summary</span></div>`,
      `<div style="background:#132941;border-left:4px solid #22d3ee;padding:12px 16px"><p style="font-size:13px;color:#e2e8f0;line-height:1.6;margin:0">${esc(n.executive_summary || "")}</p></div>`,
      `</div>`,
      // Threat Landscape
      `<div style="margin:14px 24px 0;border:1px solid #1c3350;border-radius:6px;overflow:hidden">`,
      `<div style="background:#0f2135;padding:8px 14px"><span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#22d3ee">What Changed</span><span style="font-size:10px;font-weight:700;text-transform:uppercase;color:#ffffff"> / Threat Landscape</span></div>`,
      `<table style="width:100%;border-collapse:collapse"><tr>`,
      `<td style="background:#132941;padding:14px 16px;width:60%"><ul style="list-style:none;padding:0;margin:0">${bulletHtml || '<li style="font-size:13px;color:#64748b">No significant landscape changes.</li>'}</ul></td>`,
      `<td style="background:#0f2135;padding:14px 16px;width:40%;vertical-align:top"><div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#22d3ee;margin-bottom:4px">Primary Attack Surface</div><div style="font-size:14px;font-weight:700;text-transform:uppercase;color:#ffffff;margin-bottom:6px">${esc(n.attack_surface_title || "")}</div><div style="font-size:11px;color:#94a3b8;line-height:1.5">${esc(n.attack_surface_description || "")}</div></td>`,
      `</tr></table>`,
      `</div>`,
      // Priority Queue
      `<div style="margin:14px 24px 0;border:1px solid #1c3350;border-radius:6px;overflow:hidden">`,
      `<div style="background:#0f2135;padding:8px 14px"><span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#22d3ee">Priority Queue</span><span style="font-size:10px;font-weight:700;text-transform:uppercase;color:#ffffff"> / Critical Vulnerabilities</span></div>`,
      `<table style="width:100%;border-collapse:collapse">${vulnRows}</table>`,
      `</div>`,
      // Exposure & Response
      `<div style="margin:14px 24px 0;border:1px solid #1c3350;border-radius:6px;overflow:hidden">`,
      `<div style="background:#0f2135;padding:8px 14px"><span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#22d3ee">Decision Support</span><span style="font-size:10px;font-weight:700;text-transform:uppercase;color:#ffffff"> / Exposure & Response</span></div>`,
      `<table style="width:100%;border-collapse:collapse"><tr>`,
      `<td style="background:#132941;padding:14px 16px;width:50%;vertical-align:top"><div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#22d3ee;margin-bottom:4px">Company Exposure Assessment</div><div style="font-size:13px;font-weight:700;text-transform:uppercase;color:${exposureColor};margin-bottom:8px">${esc(exposureHeadline)}</div><ul style="list-style:none;padding:0;margin:0">${exposureHtml || '<li style="font-size:12px;color:#64748b">No exposure items identified.</li>'}</ul></td>`,
      `<td style="background:#132941;padding:14px 16px;width:50%;vertical-align:top;border-left:1px solid #1c3350"><div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#22d3ee;margin-bottom:8px">Action Priority</div><div style="margin-bottom:10px"><div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#e11d48">Immediate</div><div style="font-size:12px;color:#cbd5e1;margin-top:2px">${esc(n.action_immediate || "")}</div></div><div style="margin-bottom:10px"><div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#f59e0b">This Week</div><div style="font-size:12px;color:#cbd5e1;margin-top:2px">${esc(n.action_this_week || "")}</div></div><div><div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#10b981">Ongoing</div><div style="font-size:12px;color:#cbd5e1;margin-top:2px">${esc(n.action_ongoing || "")}</div></div></td>`,
      `</tr></table>`,
      `</div>`,
      // Key Takeaway
      `<div style="margin:14px 24px 0;border:1px solid #1c3350;border-radius:6px;overflow:hidden">`,
      `<div style="background:#0f2135;padding:8px 14px"><span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#22d3ee">Key Takeaway</span><span style="font-size:10px;font-weight:700;text-transform:uppercase;color:#ffffff"> / Leadership Focus</span></div>`,
      `<div style="background:#0f2135;padding:14px 16px"><p style="font-size:13px;font-weight:600;color:#ffffff;line-height:1.6;margin:0">${esc(n.key_takeaway || "")}</p></div>`,
      `</div>`,
      // Footer
      `<div style="padding:16px 24px 20px"><div style="border-top:1px solid #1c3350;padding-top:10px;font-size:10px;color:#64748b;text-align:center">ThreatPulse Intel • threatpulseintel.com • Confidential Executive Intelligence</div></div>`,
      `</div>`,
    ].join("\n");

    const text = [
      `ThreatPulse Intel — ${period.label} Cyber Threat Intelligence Brief`,
      period.heading,
      "",
      `New Threats: ${stats.total} (${stats.cveCount} with CVE IDs) | Critical: ${stats.critical} | High: ${stats.high} | CISA KEVs: ${stats.kevCount}`,
      "",
      "EXECUTIVE SUMMARY",
      n.executive_summary || "N/A",
      "",
      "THREAT LANDSCAPE",
      ...(bullets.length ? bullets : ["N/A"]),
      "",
      `Primary Attack Surface: ${n.attack_surface_title || "N/A"}`,
      n.attack_surface_description || "",
      "",
      "CRITICAL VULNERABILITIES",
      ...(vulns.length ? vulns.map((v) => `${v.cve_id || "—"} — ${v.title} [${v.status}]`) : ["N/A"]),
      "",
      "COMPANY EXPOSURE ASSESSMENT",
      exposureHeadline,
      ...(exposureItems.length ? exposureItems : ["N/A"]),
      "",
      "ACTION PRIORITY",
      `Immediate: ${n.action_immediate || "N/A"}`,
      `This Week: ${n.action_this_week || "N/A"}`,
      `Ongoing: ${n.action_ongoing || "N/A"}`,
      "",
      "KEY TAKEAWAY",
      n.key_takeaway || "N/A",
      "",
      "Full dashboard: https://threatpulseintel.com/weekly-briefing",
    ].join("\n");

    // --- Recipients ---
    const users = await base44.asServiceRole.entities.User.list();
    let recipients = users
      .filter((u) => ["admin", "superadmin"].includes((u.role || "").toLowerCase()))
      .map((u) => u.email)
      .filter(Boolean);
    if (recipients.length === 0) {
      recipients = users.map((u) => u.email).filter(Boolean);
    }
    if (typeof body.to === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.to)) {
      recipients = [body.to];
    }

    const errors = [];
    let delivered = 0;
    for (const email of recipients) {
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${secrets.get("RESEND_API_KEY")}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from: FROM_EMAIL, to: email, subject, text, html }),
        });
        if (!res.ok) {
          const detail = await res.text().catch(() => "");
          errors.push(`${email}: ${res.status} ${detail.slice(0, 200)}`);
        } else {
          delivered++;
        }
      } catch (e) {
        errors.push(`${email}: ${e.message}`);
      }
    }

    return Response.json({
      status: "success",
      period: period.label,
      heading: period.heading,
      recipients: recipients.length,
      delivered,
      errors,
      subject,
      snapshot: {
        total_threats: inRange.length,
        new_cves: stats.cveCount,
        critical: stats.critical,
        high: stats.high,
        cisa_kev: stats.kevCount,
        priority_vulns: vulns.length,
        portfolio_matches: portfolioMatches.length,
      },
    });
  } catch (error) {
    return Response.json({ error: error?.message || "Failed to send briefing." }, { status: 500 });
  }
}