import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Download,
  FileDown,
  Loader2,
  Sparkles,
  Radar,
  Target,
  TrendingUp,
  Layers,
  ShieldCheck,
  Rocket,
  HandCoins,
  CheckCircle2,
} from "lucide-react";
import Logo from "@/components/Logo";
import InvestorOnePager from "@/components/investor/InvestorOnePager";
import GrowthProjection from "@/components/investor/GrowthProjection";
import NativeIntegrations from "@/components/investor/NativeIntegrations";
import CompetitorComparison from "@/components/investor/CompetitorComparison";
import GoToMarket from "@/components/investor/GoToMarket";
import PricingTiers from "@/components/investor/PricingTiers";
import UnitEconomics from "@/components/investor/UnitEconomics";
import { exportElementToPdf } from "@/lib/exportPdf";

const problem = [
  "Security teams drown in hundreds of daily alerts scattered across 18+ feeds — with no portfolio context.",
  "Vulnerability tracking still lives in manual spreadsheets; critical CVEs slip through the cracks.",
  "SMBs can't afford Recorded Future or Mandiant, while enterprise suites are too heavy to deploy.",
];

const solution = [
  "Automated ingestion from 18+ feeds, deduped and enriched with CVE/CVSS/EPSS every two hours.",
  "Auto-matches CVEs to your product portfolio (CPE + keywords) for instant blast-radius mapping.",
  "Standardized four-stage workflow, SLA timers, and audit-ready PDF reports — out of the box.",
];

const market = [
  { label: "TAM", value: "$27B", desc: "Threat Intelligence ($8.2B, Fortune Business Insights) + Security & Vulnerability Mgmt ($18.8B, Grand View Research), 2026." },
  { label: "SAM", value: "$6.8B", desc: "~25% of TAM — the SMB & mid-market segment underserved by enterprise suites (Recorded Future, Mandiant)." },
  { label: "SOM", value: "$140M", desc: "~2% of SAM — realistic 5-year capture. Data-backed Year 5: ~$7.7M ARR across 745 customers (see Projection)." },
];

const moat = [
  { icon: Layers, title: "Portfolio-relevant matching", desc: "CPE + keyword auto-mapping turns raw CVEs into business risk for each customer's exact stack." },
  { icon: ShieldCheck, title: "Tenant-isolated dark-web monitoring", desc: "Credential-leak & exposure tracking scoped per organization — a premium upsell moat." },
  { icon: Rocket, title: "Self-hosted from day one", desc: "Docker stack ships to regulated/air-gapped customers that competitors can't reach." },
];

const traction = [
  "Production platform live with automated feed ingestion and weekly executive briefings.",
  "Dark-web credential-leak monitoring (tenant-isolated) as a premium upsell tier.",
  "Docker-based self-hosted stack shippable to regulated customers on day one.",
];

const roadmap = [
  { phase: "Now", items: ["Automated multi-feed ingestion", "Portfolio blast-radius matching", "Weekly executive briefings"] },
  { phase: "Next 6 mo", items: ["Dark-web monitoring GA", "Slack/Teams alerting", "SBOM & VRM integrations"] },
  { phase: "12–18 mo", items: ["Predictive exploit-risk scoring", "Marketplace of licensed intel feeds", "Series A readiness"] },
];

const useOfFunds = [
  { label: "Engineering & Data Pipeline", pct: 45 },
  { label: "First GTM Hire & Demand Gen", pct: 30 },
  { label: "Data Licensing & Infra", pct: 15 },
  { label: "G&A / Compliance (SOC 2)", pct: 10 },
];

const navLinks = [
  { label: "Problem", href: "#problem" },
  { label: "Solution", href: "#solution" },
  { label: "Market", href: "#market" },
  { label: "Pricing", href: "#pricing" },
  { label: "Competition", href: "#competition" },
  { label: "Projection", href: "#projection" },
  { label: "The Ask", href: "#ask" },
];

function SectionHeader({ tag, title, className = "" }) {
  return (
    <div className={`mb-5 ${className}`}>
      <span className="text-xs font-semibold uppercase tracking-wider text-primary">{tag}</span>
      <h2 className="mt-1 text-xl sm:text-2xl font-bold tracking-tight font-heading">{title}</h2>
    </div>
  );
}

export default function Investors() {
  const [exporting, setExporting] = useState(false);

  const handleDownloadOnePager = async () => {
    setExporting(true);
    try {
      await exportElementToPdf("investor-onepager", "threatpulse-investor-one-pager.pdf");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-12 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <Logo size={22} />
            <span className="text-sm font-bold tracking-tight font-heading">ThreatPulse</span>
          </Link>
          <div className="hidden md:flex items-center gap-5 mx-auto">
            {navLinks.map((l) => (
              <a
                key={l.label}
                href={l.href}
                className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
              >
                {l.label}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleDownloadOnePager}
              disabled={exporting}
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border text-xs font-medium hover:bg-accent transition-colors disabled:opacity-50"
            >
              {exporting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />} One-Pager
            </button>
            <Link
              to="/contact-sales"
              className="px-3 py-1 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:opacity-90 transition"
            >
              Request the Deck
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 hero-gradient" />
        <div className="relative max-w-3xl mx-auto px-6 pt-10 pb-6 text-center">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20 mb-3">
            <Sparkles className="w-3.5 h-3.5" /> Investor Pitch · Confidential
          </span>
          <h1 className="text-2xl sm:text-4xl font-bold tracking-tight font-heading leading-[1.1]">
            The always-on cyber threat radar for every security team
          </h1>
          <p className="mt-3 text-sm text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            ThreatPulse automates the manual vulnerability-tracking spreadsheet — collecting, enriching, and prioritizing
            threat intelligence so analysts defend instead of hunt. Enterprise-grade threat intel, accessible to every
            security team from SMB to air-gapped enterprise.
          </p>
          <div className="mt-5 flex items-center justify-center gap-3 flex-wrap">
            <button
              onClick={handleDownloadOnePager}
              disabled={exporting}
              className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition shadow-sm inline-flex items-center gap-2 disabled:opacity-50"
            >
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
              Download One-Pager
            </button>
            <Link to="/contact-sales" className="px-5 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-accent transition inline-flex items-center gap-2">
              Request the Full Deck <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Problem */}
      <section id="problem" className="max-w-6xl mx-auto px-6 py-8">
        <SectionHeader tag="The Problem" title="Threat intelligence is broken for most teams" />
        <div className="grid md:grid-cols-3 gap-4">
          {problem.map((p, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-4">
              <div className="w-7 h-7 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center mb-2.5 text-xs font-bold">
                {i + 1}
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{p}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Solution */}
      <section id="solution" className="bg-secondary/40 border-y border-border">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <SectionHeader tag="The Solution" title="From scattered feeds to portfolio-relevant decisions" />
          <div className="grid md:grid-cols-3 gap-4">
            {solution.map((s, i) => {
              const icons = [Radar, Target, ShieldCheck];
              const Icon = icons[i];
              return (
                <div key={i} className="rounded-xl border border-border bg-card p-4">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-3">
                    <Icon className="w-5 h-5" />
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{s}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Market */}
      <section id="market" className="max-w-6xl mx-auto px-6 py-8">
        <SectionHeader tag="Market Opportunity" title="A large, underserved mid-market" />
        <div className="grid md:grid-cols-3 gap-4">
          {market.map((m) => (
            <div key={m.label} className="rounded-xl border border-border bg-card p-4 text-center">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{m.label}</p>
              <p className="text-2xl font-bold tracking-tight font-heading mt-1 text-primary">{m.value}</p>
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{m.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing / Business Model */}
      <section id="pricing" className="bg-secondary/40 border-y border-border">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <PricingTiers />
        </div>
      </section>

      {/* Unit Economics */}
      <section id="unit-economics" className="max-w-6xl mx-auto px-6 py-8">
        <UnitEconomics />
      </section>

      {/* Competitive moat */}
      <section className="bg-sidebar text-sidebar-foreground">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <SectionHeader tag="Why ThreatPulse wins" title="A defensible moat" className="text-sidebar-foreground [&_span]:text-sidebar-primary" />
          <div className="grid md:grid-cols-3 gap-4">
            {moat.map((m) => {
              const Icon = m.icon;
              return (
                <div key={m.title} className="rounded-xl border border-sidebar-border bg-sidebar-accent/50 p-4">
                  <div className="w-9 h-9 rounded-lg bg-sidebar-primary/15 text-sidebar-primary flex items-center justify-center mb-3">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="font-semibold mb-1 text-sm text-sidebar-accent-foreground">{m.title}</h3>
                  <p className="text-xs text-sidebar-foreground/60 leading-relaxed">{m.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Competitive comparison */}
      <section id="competition" className="max-w-6xl mx-auto px-6 py-8">
        <CompetitorComparison />
      </section>

      {/* Native Integrations */}
      <section id="integrations" className="bg-secondary/40 border-y border-border">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <NativeIntegrations />
        </div>
      </section>

      {/* Data-backed growth projection */}
      <section id="projection" className="max-w-6xl mx-auto px-6 py-8">
        <GrowthProjection />
      </section>

      {/* Traction + Roadmap (combined) */}
      <section id="traction" className="bg-secondary/40 border-y border-border">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="grid lg:grid-cols-2 gap-6">
            <div>
              <SectionHeader tag="Traction & Momentum" title="Shipping, not slideware" />
              <div className="space-y-3">
                {traction.map((t, i) => (
                  <div key={i} className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                    <p className="text-sm text-muted-foreground leading-relaxed">{t}</p>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <SectionHeader tag="Roadmap" title="18 months to Series A" />
              <div className="space-y-3">
                {roadmap.map((r) => (
                  <div key={r.phase} className="rounded-xl border border-border bg-card p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <TrendingUp className="w-4 h-4 text-primary" />
                      <h3 className="font-semibold text-sm">{r.phase}</h3>
                    </div>
                    <ul className="space-y-1.5">
                      {r.items.map((it) => (
                        <li key={it} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" /> {it}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Go-to-Market */}
      <section id="gtm" className="max-w-6xl mx-auto px-6 py-8">
        <GoToMarket />
      </section>

      {/* The Ask */}
      <section id="ask" className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid lg:grid-cols-2 gap-10 items-start">
          <div>
            <SectionHeader tag="The Ask" title="Two-stage capital plan" />
            <p className="text-muted-foreground leading-relaxed text-sm">
              <strong className="text-foreground">Stage 1 — Pre-seed: $750k–$1.0M</strong> (SAFE / angel) to reach first
              paying customers and a GTM hire — 12–15 months runway. <strong className="text-foreground">Stage 2 — Seed:
              $2.5–3.0M</strong> at the $1M ARR milestone (projected Year 3), scaling go-to-market and dark-web GA toward
              Series A. 5-year data-backed path: ~$7.7M ARR across 745 customers — see the live Projection section
              for current platform throughput and per-customer value, calculated in real time from the production database.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/contact-sales" className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition shadow-sm inline-flex items-center gap-2">
                Request the Full Deck <ArrowUpRight className="w-4 h-4" />
              </Link>
              <button onClick={handleDownloadOnePager} disabled={exporting} className="px-5 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-accent transition inline-flex items-center gap-2 disabled:opacity-50">
                {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />} Download One-Pager
              </button>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <HandCoins className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">Use of funds</h3>
            </div>
            <div className="space-y-3.5">
              {useOfFunds.map((u) => (
                <div key={u.label}>
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="font-medium">{u.label}</span>
                    <span className="text-muted-foreground">{u.pct}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${u.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* One-pager document */}
      <section className="bg-secondary/40 border-t border-border">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-primary">Investor document</span>
              <h2 className="mt-1.5 text-xl sm:text-2xl font-bold tracking-tight font-heading">One-page summary</h2>
              <p className="text-sm text-muted-foreground mt-1">Download a print-ready PDF to share with your investment committee.</p>
            </div>
            <button
              onClick={handleDownloadOnePager}
              disabled={exporting}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
            >
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Download PDF
            </button>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 sm:p-6 overflow-x-auto">
            <InvestorOnePager />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-secondary/30">
        <div className="max-w-6xl mx-auto px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2">
            <Logo size={22} />
            <span className="font-semibold text-sm">ThreatPulse</span>
          </Link>
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to home
          </Link>
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} ThreatPulse. Confidential — for investor review.</p>
        </div>
      </footer>
    </div>
  );
}