import React from "react";
import { Link } from "react-router-dom";
import {
  ShieldCheck,
  Lock,
  FileCheck,
  Server,
  Globe,
  KeyRound,
  History,
  Database,
  CheckCircle2,
  ArrowRight,
  Building2,
} from "lucide-react";
import Logo from "@/components/Logo";

const posture = [
  { icon: Lock, title: "Encryption at Rest & in Transit", status: "Active", desc: "TLS 1.3 in transit, AES-256 at rest. All API keys hashed with SHA-256." },
  { icon: KeyRound, title: "API Key Management", status: "Active", desc: "Scoped, revocable customer API keys with expiration and usage tracking." },
  { icon: History, title: "Full Audit Logging", status: "Active", desc: "Every threat action, status change, and assignment attributed and timestamped." },
  { icon: Database, title: "Row-Level Security", status: "Active", desc: "Per-organization data isolation enforced at the database layer." },
  { icon: Server, title: "Self-Hosted / Air-Gapped", status: "Available", desc: "Docker-based deployment for regulated and air-gapped environments." },
  { icon: Globe, title: "Data Region Selection", status: "Enterprise", desc: "US-East, US-West, EU-West, AP-Southeast residency for enterprise tier." },
];

const compliance = [
  { framework: "SOC 2 Type II", status: "In Progress", target: "Q1 2027", color: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20" },
  { framework: "NIST CSF 2.0", status: "Aligned", target: "Continuous", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  { framework: "ISO 27001:2022", status: "Mapped", target: "Q2 2027", color: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  { framework: "PCI DSS v4", status: "Mapped", target: "On request", color: "bg-violet-500/10 text-violet-600 border-violet-500/20" },
];

const features = [
  "Role-based access control (Superadmin, Admin, Analyst)",
  "Per-organization data isolation with row-level security",
  "SAML SSO available on Enterprise tier",
  "SCIM user provisioning (Enterprise)",
  "Configurable data retention windows (30–365 days)",
  "Customer-managed API keys with scoped permissions",
  "Configurable SLA policies with escalation routing",
  "Audit-ready PDF and CSV exports",
];

export default function TrustCenter() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Logo size={26} />
            <span className="text-sm font-bold tracking-tight font-heading">ThreatPulse</span>
          </Link>
          <Link to="/" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            Back to home
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 hero-gradient" />
        <div className="relative max-w-3xl mx-auto px-6 pt-16 pb-8 text-center">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20 mb-4">
            <ShieldCheck className="w-3.5 h-3.5" /> Trust Center
          </span>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight font-heading">
            Security & compliance, by design
          </h1>
          <p className="mt-3 text-sm text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            ThreatPulse is built for teams that answer to auditors, regulators, and boards.
            This page documents our security posture, compliance alignment, and the controls
            that protect your data.
          </p>
        </div>
      </section>

      {/* Security posture */}
      <section className="max-w-5xl mx-auto px-6 py-8">
        <h2 className="text-xl font-bold tracking-tight font-heading mb-4">Security Posture</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {posture.map((p) => {
            const Icon = p.icon;
            return (
              <div key={p.title} className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold border bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                    <CheckCircle2 className="w-3 h-3" /> {p.status}
                  </span>
                </div>
                <h3 className="font-semibold text-sm mb-1">{p.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{p.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Compliance */}
      <section className="bg-secondary/40 border-y border-border">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <h2 className="text-xl font-bold tracking-tight font-heading mb-4">Compliance Alignment</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {compliance.map((c) => (
              <div key={c.framework} className="rounded-xl border border-border bg-card p-5 text-center">
                <FileCheck className="w-8 h-8 mx-auto mb-3 text-primary" />
                <h3 className="font-semibold text-sm">{c.framework}</h3>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border mt-2 ${c.color}`}>
                  {c.status}
                </span>
                <p className="text-xs text-muted-foreground mt-2">Target: {c.target}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-4 text-center">
            Compliance reports available under NDA for enterprise customers.{" "}
            <Link to="/contact-sales" className="text-primary hover:underline">Request a report →</Link>
          </p>
        </div>
      </section>

      {/* Enterprise controls */}
      <section className="max-w-5xl mx-auto px-6 py-8">
        <h2 className="text-xl font-bold tracking-tight font-heading mb-4">Enterprise Controls</h2>
        <div className="rounded-xl border border-border bg-card p-6">
          <ul className="grid sm:grid-cols-2 gap-3">
            {features.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <span className="text-muted-foreground">{f}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-5xl mx-auto px-6 py-8">
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <Building2 className="w-10 h-10 mx-auto mb-3 text-primary" />
          <h2 className="text-xl font-bold tracking-tight font-heading">Need a security review?</h2>
          <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
            Enterprise customers get a dedicated security review, custom DPA, and access to our compliance documentation.
          </p>
          <Link
            to="/contact-sales"
            className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition shadow-sm"
          >
            Contact Sales <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-secondary/30">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Logo size={22} />
            <span className="font-semibold text-sm">ThreatPulse</span>
          </Link>
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} ThreatPulse. Trust Center.</p>
        </div>
      </footer>
    </div>
  );
}