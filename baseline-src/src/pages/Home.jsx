import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import {
  Radar,
  Crosshair,
  FileDown,
  ClipboardList,
  Gauge,
  Clock,
  TrendingUp,
  History,
  Workflow,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Shield,
  AlertTriangle,
  Zap,
  RefreshCw,
  Lock,
  Users,
  FileCheck,
  Layers,
  Filter,
  ShieldCheck,
  Sparkles,
  Activity,
} from "lucide-react";
import SeverityBadge from "@/components/SeverityBadge";
import Logo from "@/components/Logo";

const features = [
  { icon: Radar, title: "Real-Time Collection", desc: "Automated ingestion from 18+ trusted feeds — CISA KEV, NVD, US-CERT, Krebs, Bleeping Computer, Dark Reading, The Hacker News, SANS ISC, Recorded Future, Unit 42, Talos, Schneier, and more — every hour." },
  { icon: ClipboardList, title: "Standardized Investigation Workflow", desc: "Every threat follows a four-stage template — Triage → Root Cause Analysis → Remediation → Verification — so no step gets skipped." },
  { icon: FileDown, title: "PDF Investigation Reports", desc: "Generate a one-click, audit-ready PDF for any threat: summary, steps, blast radius, impact, and full activity timeline." },
  { icon: Crosshair, title: "Blast Radius with Active Versions", desc: "Track each portfolio asset's currently deployed version. High-severity threats map straight to the exact versions at risk." },
  { icon: Gauge, title: "Impact Assessment", desc: "Auto-estimated downtime hours and recovery costs per threat, weighted by severity and affected product breadth — quantified business risk." },
  { icon: Clock, title: "SLA Compliance & Breach Alerts", desc: "Severity-based SLA timers with automated breach detection that escalates Critical threats to your SOC lead." },
  { icon: TrendingUp, title: "30-Day Threat Trends", desc: "Volume and severity breakdown charts over the trailing 30 days to spot surges before they become incidents." },
  { icon: History, title: "Full Audit Timeline", desc: "Every status change, assignment, note, and investigation step is logged with attribution for complete accountability." },
  { icon: Workflow, title: "Analyst Workflow", desc: "Track threats from New → Analyzing → Mitigated with reviewer attribution, timestamps, and org-level notes." },
];

const sources = ["CISA KEV", "NVD", "US-CERT/CISA", "CISA Alerts", "Krebs on Security", "Bleeping Computer", "Dark Reading", "SANS ISC", "Threatpost", "SecurityWeek", "Recorded Future", "Unit 42", "Talos Intelligence", "The Hacker News", "Schneier on Security", "Naked Security", "Malwarebytes Labs", "Graham Cluley", "The Record", "CyberScoop"];

const stats = [
  { value: "18+", label: "Intelligence feeds" },
  { value: "4-Stage", label: "Investigation workflow" },
  { value: "30-Day", label: "Trend analytics" },
  { value: "24/7", label: "Automated collection" },
];

const steps = [
  { icon: Radar, title: "Collect", desc: "Automated ingestion pulls from 11 authoritative sources every hour — deduplicated and normalized." },
  { icon: Filter, title: "Enrich", desc: "Each threat is enriched with CVE IDs, CVSS scores, affected products, and auto-estimated business impact." },
  { icon: ClipboardList, title: "Investigate", desc: "A standardized four-stage workflow with SLA timers keeps every analyst aligned and accountable." },
  { icon: FileDown, title: "Report", desc: "Export audit-ready PDF reports with full activity timelines for leadership and compliance." },
];

const securityPoints = [
  { icon: Users, title: "Role-based access", desc: "Superadmin, Admin, and Analyst roles with enforced row-level security." },
  { icon: Lock, title: "Data isolation", desc: "Each workspace sees and tracks only its own threat responses." },
  { icon: History, title: "Full audit logging", desc: "Every action is attributed and timestamped for accountability." },
  { icon: FileCheck, title: "Audit-ready exports", desc: "One-click PDF reports built for compliance and executive review." },
];

const navLinks = [
  { label: "Platform", href: "#features" },
  { label: "Workflow", href: "#workflow" },
  { label: "Security", href: "#security" },
  { label: "Feeds", href: "#feeds" },
];

export default function Home() {
  const [threats, setThreats] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.Threat.list("-created_date", 50)
      .then(setThreats)
      .catch(() => setThreats([]))
      .finally(() => setLoading(false));
  }, []);

  const total = threats.length;
  const active = threats.filter((t) => t.status !== "Mitigated");
  const criticalActive = threats.filter((t) => t.severity === "Critical" && t.status !== "Mitigated");
  const newToday = threats.filter((t) => new Date(t.created_date).toDateString() === new Date().toDateString());
  const sevCounts = { Critical: 0, High: 0, Medium: 0, Low: 0 };
  threats.forEach((t) => { if (sevCounts[t.severity] != null) sevCounts[t.severity] += 1; });
  const watchlist = (criticalActive.length ? criticalActive : threats).slice(0, 3);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Logo size={32} />
            <span className="text-lg font-bold tracking-tight">ThreatPulse</span>
          </Link>
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((l) => (
              <a key={l.label} href={l.href} className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                {l.label}
              </a>
            ))}
            <Link to="/shop" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Shop</Link>
            <Link to="/pricing" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Pricing</Link>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/free" className="hidden sm:inline text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Live Preview</Link>
            <Link to="/login" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Sign in</Link>
            <Link to="/register" className="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition shadow-sm">Get Started Free</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 hero-gradient" />
        <div className="relative max-w-5xl mx-auto px-6 pt-20 pb-12 text-center">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20 mb-6">
            <Sparkles className="w-3.5 h-3.5" />
            Enterprise Threat Intelligence Platform
          </span>
          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight text-foreground leading-[1.1] font-heading">
            Your team's always-on<br />cyber threat radar
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            ThreatPulse continuously monitors the world's top security sources and turns raw intelligence into
            actionable, portfolio-relevant decisions — so your analysts spend less time hunting and more time defending.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3 flex-wrap">
            <Link to="/register" className="px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition shadow-sm inline-flex items-center gap-2">
              Get Started Free <ArrowRight className="w-4 h-4" />
            </Link>
            <Link to="/free" className="px-6 py-3 rounded-lg border border-border font-medium hover:bg-accent transition">View Last 12hr Threats</Link>
          </div>
          <div className="mt-7 flex items-center justify-center gap-x-6 gap-y-2 flex-wrap text-xs text-muted-foreground">
            {["No credit card required", "Role-based access", "Audit-ready reporting"].map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-primary" /> {t}
              </span>
            ))}
          </div>
        </div>

        {/* Stat band */}
        <div className="relative max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px rounded-2xl border border-border bg-border overflow-hidden shadow-sm">
            {stats.map((s) => (
              <div key={s.label} className="bg-card px-6 py-5 text-center">
                <p className="text-2xl font-bold tracking-tight font-heading">{s.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Command Center preview */}
        <div className="relative max-w-5xl mx-auto px-6 pt-12 pb-16">
          <div className="rounded-2xl border border-border bg-card shadow-2xl overflow-hidden ring-1 ring-border/50">
            <div className="flex">
              <div className="w-44 bg-sidebar p-4 hidden sm:flex flex-col">
                <div className="flex items-center gap-2 mb-6">
                  <div className="w-6 h-6 rounded bg-sidebar-primary" />
                  <span className="text-sm font-bold text-sidebar-foreground">ThreatPulse</span>
                </div>
                {["Command Center", "Threats", "Blast Radius", "Portfolio"].map((l, i) => (
                  <div key={l} className={`px-2 py-1.5 rounded text-xs mb-1 ${i === 0 ? "bg-sidebar-primary text-sidebar-primary-foreground" : "text-sidebar-foreground/70"}`}>{l}</div>
                ))}
              </div>
              <div className="flex-1 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Radar className="w-5 h-5 text-primary" />
                    <h3 className="text-lg font-semibold">Command Center</h3>
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> LIVE
                    </span>
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium">
                    <RefreshCw className="w-3.5 h-3.5" /> Collect Now
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-3 mb-4">
                  {[
                    { icon: Shield, label: "Total Threats", value: total, sub: `${active.length} active` },
                    { icon: AlertTriangle, label: "Critical Active", value: criticalActive.length, sub: "needs triage" },
                    { icon: Zap, label: "New Today", value: newToday.length, sub: "last 24h" },
                    { icon: Clock, label: "Avg Response", value: "—", sub: "hrs to close" },
                  ].map((k) => {
                    const Icon = k.icon;
                    return (
                      <div key={k.label} className="rounded-lg border border-border p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{k.label}</span>
                          <Icon className="w-3.5 h-3.5 text-primary" />
                        </div>
                        <p className="text-xl font-bold">{loading ? "—" : k.value}</p>
                        <p className="text-[10px] text-muted-foreground">{k.sub}</p>
                      </div>
                    );
                  })}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-semibold mb-2">Severity Distribution</p>
                    <div className="space-y-1.5">
                      {["Critical", "High", "Medium", "Low"].map((s) => {
                        const c = sevCounts[s] || 0;
                        const pct = total ? (c / total) * 100 : 0;
                        return (
                          <div key={s} className="flex items-center gap-2">
                            <span className="text-[10px] w-12 text-muted-foreground">{s}</span>
                            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                              <div className={`h-full rounded-full ${s === "Critical" ? "bg-red-500" : s === "High" ? "bg-orange-500" : s === "Medium" ? "bg-yellow-500" : "bg-blue-500"}`} style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-[10px] text-muted-foreground w-4 text-right">{c}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold mb-2">Critical Watchlist</p>
                    <div className="space-y-1.5">
                      {watchlist.map((t) => (
                        <div key={t.id} className="flex items-center gap-2 text-xs">
                          <SeverityBadge severity={t.severity} />
                          <span className="truncate text-muted-foreground">{t.title}</span>
                        </div>
                      ))}
                      {loading && Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="h-4 rounded bg-muted animate-pulse" />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <p className="text-center text-xs text-muted-foreground mt-4">Command Center — portfolio-relevant threat operations, live</p>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-7xl mx-auto px-6 py-20">
        <div className="max-w-2xl mb-12">
          <span className="text-xs font-semibold uppercase tracking-wider text-primary">Platform</span>
          <h2 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight font-heading">Everything your SOC needs, in one place</h2>
          <p className="mt-3 text-muted-foreground leading-relaxed">
            Built for security analysts, incident responders, and threat intelligence teams who can't afford to miss a beat.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="group rounded-2xl border border-border bg-card p-6 hover:shadow-lg hover:border-primary/30 transition-all">
                <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="font-semibold mb-1.5">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* How it works */}
      <section id="workflow" className="bg-secondary/40 border-y border-border">
        <div className="max-w-7xl mx-auto px-6 py-20">
          <div className="max-w-2xl mb-12">
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">How it works</span>
            <h2 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight font-heading">From raw feed to audit-ready report</h2>
            <p className="mt-3 text-muted-foreground leading-relaxed">
              A repeatable pipeline that turns scattered threat data into decisions your team can defend.
            </p>
          </div>
          <div className="grid md:grid-cols-4 gap-6">
            {steps.map((s, i) => {
              const Icon = s.icon;
              return (
                <div key={s.title} className="relative rounded-2xl border border-border bg-card p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-3xl font-bold text-muted-foreground/20 font-heading">{i + 1}</span>
                  </div>
                  <h3 className="font-semibold mb-1.5">{s.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Threat cards preview */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="max-w-2xl mb-12">
          <span className="text-xs font-semibold uppercase tracking-wider text-primary">Enriched intelligence</span>
          <h2 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight font-heading">Every threat, fully contextualized</h2>
          <p className="mt-3 text-muted-foreground leading-relaxed">
            Each threat is enriched with CVE IDs, CVSS scores, affected products, and source links — with status, notes, and ownership tracked in-platform.
          </p>
        </div>
        <ul className="grid sm:grid-cols-2 gap-3 max-w-3xl text-sm text-muted-foreground mb-10">
          {[
            "CVE cross-reference with CVSS scoring",
            "Standardized four-stage investigation template",
            "Blast radius mapped to active product versions",
            "Auto-estimated downtime and recovery costs",
            "One-click PDF investigation reports",
            "SLA timers with automated breach alerts",
            "Full audit timeline with attribution",
            "30-day volume & severity trend analytics",
          ].map((item) => (
            <li key={item} className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              {item}
            </li>
          ))}
        </ul>
        <div className="grid md:grid-cols-3 gap-5">
          {(threats.length ? threats : []).slice(0, 3).map((t) => (
            <div key={t.id} className="rounded-2xl border border-border bg-card p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-2 flex-wrap mb-3">
                <SeverityBadge severity={t.severity} />
                <span className="text-xs font-medium text-muted-foreground uppercase">{t.type}</span>
                {t.cve_id && <span className="text-xs font-mono text-muted-foreground">{t.cve_id}</span>}
                {t.cvss_score != null && <span className="text-xs font-mono text-muted-foreground">CVSS {t.cvss_score}</span>}
              </div>
              <h3 className="font-semibold text-sm leading-snug mb-2">{t.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{t.description}</p>
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
                <p className="text-xs text-muted-foreground">{t.source}</p>
                <Activity className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Security & compliance */}
      <section id="security" className="bg-sidebar text-sidebar-foreground">
        <div className="max-w-7xl mx-auto px-6 py-20">
          <div className="grid lg:grid-cols-2 gap-12 items-start">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-sidebar-primary">Security & governance</span>
              <h2 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight font-heading">Enterprise-grade by design</h2>
              <p className="mt-3 text-sidebar-foreground/70 leading-relaxed max-w-lg">
                ThreatPulse is built for teams that answer to auditors, regulators, and boards. Role-based access,
                row-level isolation, and complete audit trails come standard.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                {["Role-based access control", "Row-level data isolation", "Full audit logging", "Audit-ready PDF exports"].map((b) => (
                  <span key={b} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-sidebar-accent text-sidebar-accent-foreground border border-sidebar-border">
                    <ShieldCheck className="w-3.5 h-3.5 text-sidebar-primary" /> {b}
                  </span>
                ))}
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              {securityPoints.map((p) => {
                const Icon = p.icon;
                return (
                  <div key={p.title} className="rounded-2xl border border-sidebar-border bg-sidebar-accent/50 p-6">
                    <div className="w-10 h-10 rounded-lg bg-sidebar-primary/15 text-sidebar-primary flex items-center justify-center mb-4">
                      <Icon className="w-5 h-5" />
                    </div>
                    <h3 className="font-semibold mb-1.5 text-sidebar-accent-foreground">{p.title}</h3>
                    <p className="text-sm text-sidebar-foreground/60 leading-relaxed">{p.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Sources */}
      <section id="feeds" className="max-w-5xl mx-auto px-6 py-20 text-center">
        <span className="text-xs font-semibold uppercase tracking-wider text-primary">Intelligence sources</span>
        <h2 className="mt-2 text-3xl font-bold tracking-tight font-heading">From sources your team already trusts</h2>
        <p className="mt-3 text-muted-foreground mb-10">Aggregated, deduplicated, and enriched — automatically.</p>
        <div className="flex flex-wrap justify-center gap-3">
          {sources.map((s) => (
            <span key={s} className="px-4 py-2 rounded-xl border border-border bg-card text-sm font-medium text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors">{s}</span>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 py-20">
          <div className="relative rounded-3xl border border-border bg-card overflow-hidden px-8 py-14 text-center shadow-lg">
            <div className="absolute inset-0 hero-gradient opacity-70" />
            <div className="relative">
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight font-heading">Ready to protect your organization?</h2>
              <p className="mt-3 text-muted-foreground mb-8 max-w-xl mx-auto leading-relaxed">
                Start with the free preview, then join your team with an access code or reach out to set up a new organization.
              </p>
              <div className="flex items-center justify-center gap-3 flex-wrap">
                <Link to="/free" className="px-6 py-3 rounded-lg border border-border font-medium hover:bg-accent transition">Try Free Preview</Link>
                <Link to="/register" className="px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition inline-flex items-center gap-2 shadow-sm">
                  Get Full Access <ArrowUpRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-secondary/30">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="grid md:grid-cols-4 gap-8 mb-10">
            <div>
              <Link to="/" className="flex items-center gap-2 mb-3">
                <Logo size={26} />
                <span className="font-semibold">ThreatPulse</span>
              </Link>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
                Automated threat intelligence for security operations teams.
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Product</p>
              <ul className="space-y-2 text-sm">
                <li><Link to="/command-center" className="text-muted-foreground hover:text-foreground transition-colors">Command Center</Link></li>
                <li><Link to="/threat-feed" className="text-muted-foreground hover:text-foreground transition-colors">Threat Feed</Link></li>
                <li><Link to="/blast-radius" className="text-muted-foreground hover:text-foreground transition-colors">Blast Radius</Link></li>
                <li><Link to="/product-portfolio" className="text-muted-foreground hover:text-foreground transition-colors">Product Portfolio</Link></li>
                <li><Link to="/shop" className="text-muted-foreground hover:text-foreground transition-colors">ThreatPulse Gear</Link></li>
                <li><Link to="/pricing" className="text-muted-foreground hover:text-foreground transition-colors">Pricing</Link></li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Platform</p>
              <ul className="space-y-2 text-sm">
                <li><a href="#features" className="text-muted-foreground hover:text-foreground transition-colors">Features</a></li>
                <li><a href="#workflow" className="text-muted-foreground hover:text-foreground transition-colors">Workflow</a></li>
                <li><a href="#security" className="text-muted-foreground hover:text-foreground transition-colors">Security</a></li>
                <li><a href="#feeds" className="text-muted-foreground hover:text-foreground transition-colors">Intelligence Feeds</a></li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Get started</p>
              <ul className="space-y-2 text-sm">
                <li><Link to="/register" className="text-muted-foreground hover:text-foreground transition-colors">Create account</Link></li>
                <li><Link to="/login" className="text-muted-foreground hover:text-foreground transition-colors">Sign in</Link></li>
                <li><Link to="/free" className="text-muted-foreground hover:text-foreground transition-colors">Live preview</Link></li>
                <li><Link to="/how-it-works" className="text-muted-foreground hover:text-foreground transition-colors">How it works</Link></li>
              </ul>
            </div>
          </div>
          <div className="flex items-center justify-between flex-wrap gap-4 pt-6 border-t border-border">
            <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} ThreatPulse. Automated Threat Intelligence Platform.</p>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <Link to="/policy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
              <Link to="/compliance" className="hover:text-foreground transition-colors">Compliance</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}