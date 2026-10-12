import React from "react";
import Logo from "@/components/Logo";

// A print-ready, A4-styled one-pager. Rendered inline and captured to PDF via exportElementToPdf.
export default function InvestorOnePager() {
  return (
    <div
      id="investor-onepager"
      className="mx-auto bg-white text-slate-900"
      style={{ width: "794px", maxWidth: "100%", fontFamily: "Inter, Arial, sans-serif" }}
    >
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg,#0f172a,#0e93b8)", color: "#fff", padding: "28px 36px", borderRadius: "12px" }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Logo size={30} />
            <span className="text-lg font-bold tracking-tight">ThreatPulse</span>
          </div>
          <span className="text-[11px] uppercase tracking-widest text-cyan-200 font-semibold">Investor One-Pager · Confidential</span>
        </div>
        <h1 className="text-2xl font-bold mt-4 leading-tight">The always-on cyber threat radar for every security team</h1>
        <p className="text-sm text-cyan-100/90 mt-2 leading-relaxed max-w-xl">
          ThreatPulse automates the manual vulnerability-tracking spreadsheet — collecting, enriching, and prioritizing
          threat intelligence so analysts defend instead of hunt.
        </p>
      </div>

      {/* Body grid */}
      <div className="grid grid-cols-2 gap-5 p-7">
        <Section title="The Problem">
          <ul className="space-y-1.5 text-[12px] leading-relaxed text-slate-700">
            <li>• SOCs drown in 100s of daily alerts across 18+ scattered feeds — no portfolio context.</li>
            <li>• Vulnerability tracking still lives in manual spreadsheets; CVEs slip through the cracks.</li>
            <li>• SMBs can't afford Recorded Future / Mandiant; enterprise tools are too heavy to deploy.</li>
          </ul>
        </Section>

        <Section title="The Solution">
          <ul className="space-y-1.5 text-[12px] leading-relaxed text-slate-700">
            <li>• Automated ingestion from 18+ feeds, deduped & enriched with CVE/CVSS/EPSS every 2 hours.</li>
            <li>• Auto-matches CVEs to your product portfolio (CPE + keywords) for blast-radius mapping.</li>
            <li>• Standardized 4-stage workflow, SLA timers, and audit-ready PDF reports out of the box.</li>
          </ul>
        </Section>

        <Section title="Market Opportunity">
          <ul className="space-y-1.5 text-[12px] leading-relaxed text-slate-700">
            <li>• <strong>TAM ~$27B</strong> — Threat Intelligence ($8.2B) + Security & Vulnerability Mgmt ($18.8B), 2026 (Fortune Business Insights, Grand View Research).</li>
            <li>• <strong>SAM ~$6.8B</strong> — ~25% of TAM; SMB & mid-market segment underserved by enterprise suites.</li>
            <li>• <strong>SOM ~$140M</strong> — ~2% of SAM (5-yr capture); data-backed Year 5: ~$7.7M ARR across 745 customers.</li>
          </ul>
        </Section>

        <Section title="Business Model">
          <ul className="space-y-1.5 text-[12px] leading-relaxed text-slate-700">
            <li>• <strong>SaaS tiers:</strong> Free → Small/Midsize $399/mo → Enterprise from $7,500/mo.</li>
            <li>• <strong>Self-Hosted:</strong> $150k/yr license for regulated/air-gapped deployments.</li>
            <li>• Land-and-expand: free preview → paid seat expansion → enterprise rollout.</li>
          </ul>
        </Section>

        <Section title="Traction & Momentum">
          <ul className="space-y-1.5 text-[12px] leading-relaxed text-slate-700">
            <li>• Production platform live with automated feed ingestion & weekly executive briefings.</li>
            <li>• Dark-web credential-leak monitoring (tenant-isolated) as premium upsell.</li>
            <li>• Docker-based self-hosted stack shippable to regulated customers on day one.</li>
          </ul>
        </Section>

        <Section title="The Ask">
          <ul className="space-y-1.5 text-[12px] leading-relaxed text-slate-700">
            <li>• <strong>Stage 1 — Pre-seed $750k–$1.0M</strong> (SAFE/angel) → first paying customers + GTM hire (12–15 mo).</li>
            <li>• <strong>Stage 2 — Seed $2.5–3.0M</strong> at $1M ARR → scale GTM &amp; dark-web GA toward Series A.</li>
            <li>• Use of funds (pre-seed): 45% engineering/data, 30% first GTM hire, 15% data licensing, 10% G&amp;A/SOC 2.</li>
            <li>• 5-yr data-backed path: ~$7.7M ARR across 745 customers (live metrics on the investor page).</li>
          </ul>
        </Section>
      </div>

      {/* Footer */}
      <div className="px-7 pb-6">
        <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "12px" }} className="flex items-center justify-between text-[10px] text-slate-500">
          <span>ThreatPulse · threatpulseintel.com · Confidential — for investor review only</span>
          <span>© {new Date().getFullYear()} ThreatPulse</span>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ border: "1px solid #e2e8f0", borderRadius: "10px", padding: "14px 16px", background: "#f8fafc" }}>
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-900 mb-2">{title}</h3>
      {children}
    </div>
  );
}