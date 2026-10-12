import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';

const SALES_EMAIL = "sales@threatpulseintel.com";
const FROM_EMAIL = "ThreatPulse Sales <noreply@threatpulseintel.com>";

const tierLabel = (t) =>
  t === "Enterprise" ? "Enterprise"
    : t === "SmallMidsize" ? "Small to Midsize"
    : t === "SelfHosted" ? "Self-Hosted"
    : "General Inquiry";

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export default async function(req: Request): Promise<Response> {
  try {
    const body = await req.json().catch(() => ({}));
    const name = (body?.name || "").trim();
    const email = (body?.email || "").trim();
    const company = (body?.company || "").trim();
    const teamSize = (body?.teamSize || "").trim();
    const tier = body?.tier || "General";
    const message = (body?.message || "").trim();

    if (!name || !email || !company || !message) {
      return Response.json({ error: "Missing required fields." }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ error: "Please enter a valid email address." }, { status: 400 });
    }

    const subject = `New ${tierLabel(tier)} inquiry from ${company}`;
    const text = [
      "New sales inquiry submitted via the ThreatPulse pricing page.",
      "",
      `Tier of interest: ${tierLabel(tier)}`,
      `Name: ${name}`,
      `Email: ${email}`,
      `Company: ${company}`,
      teamSize ? `Team size: ${teamSize}` : null,
      "",
      "Message:",
      message,
    ]
      .filter(Boolean)
      .join("\n");

    const html = [
      `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:auto;color:#0f172a">`,
      `<h2 style="margin:0 0 12px">New ${esc(tierLabel(tier))} inquiry</h2>`,
      `<p style="margin:0 0 16px;color:#475569">Submitted via the ThreatPulse pricing page.</p>`,
      `<table style="border-collapse:collapse;font-size:14px;width:100%;margin-bottom:16px">`,
      `<tr><td style="padding:6px 0;color:#64748b;width:140px">Tier of interest</td><td style="padding:6px 0;font-weight:600">${esc(tierLabel(tier))}</td></tr>`,
      `<tr><td style="padding:6px 0;color:#64748b">Name</td><td style="padding:6px 0">${esc(name)}</td></tr>`,
      `<tr><td style="padding:6px 0;color:#64748b">Email</td><td style="padding:6px 0"><a href="mailto:${esc(email)}" style="color:#0ea5e9">${esc(email)}</a></td></tr>`,
      `<tr><td style="padding:6px 0;color:#64748b">Company</td><td style="padding:6px 0">${esc(company)}</td></tr>`,
      teamSize ? `<tr><td style="padding:6px 0;color:#64748b">Team size</td><td style="padding:6px 0">${esc(teamSize)}</td></tr>` : "",
      `</table>`,
      `<p style="margin:4px 0 6px;font-size:14px;color:#64748b">Message</p>`,
      `<div style="border-left:3px solid #0ea5e9;padding:8px 12px;background:#f8fafc;white-space:pre-wrap;font-size:14px">${esc(message)}</div>`,
      `<p style="margin-top:24px;font-size:12px;color:#94a3b8">Reply directly to the inquirer at ${esc(email)}.</p>`,
      `</div>`,
    ]
      .filter(Boolean)
      .join("\n");

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secrets.get("RESEND_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: SALES_EMAIL,
        reply_to: email,
        subject,
        text,
        html,
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return Response.json(
        { error: `Email delivery failed (${res.status}). ${detail.slice(0, 300)}` },
        { status: 502 }
      );
    }

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error?.message || "Failed to submit inquiry." }, { status: 500 });
  }
}